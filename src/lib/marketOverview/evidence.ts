// src/lib/marketOverview/evidence.ts — "Cosa dice la storia": statistiche
// calcolate sul dataset Shiller (borsa USA, mensile dal 1871) che rispondono a
// tre domande concrete di chi si chiede se sia il momento giusto:
//
//   1. Con valutazioni come quelle di oggi, quanto ha reso la borsa nei 10 anni
//      successivi?                                    → capeBuckets
//   2. Quanto conta per quanto tempo si resta investiti? → holdingStats
//   3. Investire quando la borsa è sui massimi è stato un errore? → highStats
//
// Sono FREQUENZE STORICHE, non previsioni. Tutti i rendimenti sono reali (al
// netto dell'inflazione) e con dividendi reinvestiti, annualizzati.
import type { ShillerRow } from './shiller'
import { percentileOf, buildPercentileSignal, downsample, type SeriesPoint, type MarketSignal } from './signals'

export interface Distribution {
  n:           number          // numero di mesi di partenza osservati
  p10:         number          // % annuo: 1 caso su 10 è andato peggio di così
  median:      number
  p90:         number
  pctNegative: number          // % dei casi chiusi sotto il valore reale di partenza
}

export interface CapeBucket extends Distribution {
  label:    string             // es. "20 – 25"
  current:  boolean            // la fascia in cui cade il CAPE di oggi
  episodes: number             // anni di calendario distinti coperti: pochi = evidenza debole
}

export interface HoldingStat extends Distribution { years: number; worst: number; best: number }

export interface HighStat {
  years:    number
  nearHigh: Distribution       // partenze entro il 2% dal massimo storico
  other:    Distribution       // tutte le altre partenze
}

export interface EquityEvidence {
  asOf:          string         // ultimo mese del dataset (YYYY-MM)
  firstYear:     number
  cape:          number
  capePctAll:    number         // percentile sull'intera storia
  capePct30y:    number         // percentile sugli ultimi 30 anni
  capeMedianAll: number
  capeMedian30y: number
  ecy:           number | null  // Excess CAPE Yield (%)
  ecyPct30y:     number | null
  buckets:       CapeBucket[]
  holding:       HoldingStat[]
  highs:         HighStat[]
  nearHighNow:   boolean
  capeSeries:    SeriesPoint[]  // solo per il grafico: non viene salvata in cache
}

/** Le evidenze così come stanno in cache (senza la serie del grafico). */
export type StoredEquityEvidence = Omit<EquityEvidence, 'capeSeries'>

const r1 = (n: number) => Math.round(n * 10) / 10

/** Quantile per interpolazione lineare su un array ORDINATO crescente. */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos), hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

export function distribution(values: number[]): Distribution | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  return {
    n: s.length,
    p10: r1(quantile(s, 0.1)),
    median: r1(quantile(s, 0.5)),
    p90: r1(quantile(s, 0.9)),
    pctNegative: Math.round((s.filter((v) => v < 0).length / s.length) * 100),
  }
}

/**
 * Rendimento reale annualizzato (%) dei `years` anni SUCCESSIVI a ogni mese.
 * Null per i mesi troppo recenti per avere un "dopo" completo.
 */
export function forwardReturns(rows: ShillerRow[], years: number): (number | null)[] {
  const h = years * 12
  return rows.map((r, i) => {
    const end = rows[i + h]
    if (!end || r.realTR <= 0) return null
    return (Math.pow(end.realTR / r.realTR, 1 / years) - 1) * 100
  })
}

// Fasce fisse di CAPE (media storica ≈ 17). Ogni fascia: [min, max).
const CAPE_BANDS: [number, number, string][] = [
  [0, 10, 'sotto 10'], [10, 15, '10 – 15'], [15, 20, '15 – 20'],
  [20, 25, '20 – 25'], [25, 30, '25 – 30'], [30, Infinity, 'oltre 30'],
]

export function capeBuckets(rows: ShillerRow[], currentCape: number, years = 10): CapeBucket[] {
  const fwd = forwardReturns(rows, years)
  return CAPE_BANDS.flatMap(([lo, hi, label]) => {
    const vals: number[] = []
    const yearsSeen = new Set<string>()
    rows.forEach((r, i) => {
      const f = fwd[i]
      if (r.cape === null || f === null || r.cape < lo || r.cape >= hi) return
      vals.push(f)
      yearsSeen.add(r.date.slice(0, 4))
    })
    const d = distribution(vals)
    return d ? [{ ...d, label, current: currentCape >= lo && currentCape < hi, episodes: yearsSeen.size }] : []
  })
}

export function holdingStats(rows: ShillerRow[], horizons = [1, 5, 10, 20]): HoldingStat[] {
  return horizons.flatMap((years) => {
    const vals = forwardReturns(rows, years).filter((v): v is number => v !== null)
    const d = distribution(vals)
    return d ? [{ ...d, years, worst: r1(Math.min(...vals)), best: r1(Math.max(...vals)) }] : []
  })
}

const NEAR_HIGH = 0.98

/** Per ogni mese: il prezzo era entro il 2% dal massimo storico fino a quel momento? */
export function nearHighFlags(rows: ShillerRow[]): boolean[] {
  let max = 0
  return rows.map((r) => {
    max = Math.max(max, r.price)
    return r.price >= max * NEAR_HIGH
  })
}

export function highStats(rows: ShillerRow[], horizons = [1, 5, 10]): HighStat[] {
  const flags = nearHighFlags(rows)
  return horizons.flatMap((years) => {
    const fwd = forwardReturns(rows, years)
    const near: number[] = [], other: number[] = []
    fwd.forEach((f, i) => { if (f !== null) (flags[i] ? near : other).push(f) })
    const a = distribution(near), b = distribution(other)
    return a && b ? [{ years, nearHigh: a, other: b }] : []
  })
}

/** Assembla tutte le evidenze. Null se il dataset non contiene un CAPE corrente. */
export function buildEquityEvidence(rows: ShillerRow[]): EquityEvidence | null {
  const withCape = rows.filter((r): r is ShillerRow & { cape: number } => r.cape !== null)
  const current = withCape[withCape.length - 1]
  const lastRow = rows[rows.length - 1]
  if (!current || !lastRow || current.date !== lastRow.date) return null

  const all = withCape.map((r) => r.cape)
  const last30 = withCape.slice(-360).map((r) => r.cape)
  const median = (xs: number[]) => r1(quantile([...xs].sort((a, b) => a - b), 0.5))

  const ecyRows = rows.filter((r): r is ShillerRow & { ecy: number } => r.ecy !== null)
  const ecyNow = ecyRows[ecyRows.length - 1]
  const ecyCurrent = ecyNow && ecyNow.date === lastRow.date ? ecyNow.ecy : null
  const flags = nearHighFlags(rows)

  return {
    asOf: lastRow.date,
    firstYear: parseInt(rows[0].date.slice(0, 4), 10),
    cape: r1(current.cape),
    capePctAll: Math.round(percentileOf(current.cape, all) ?? 0),
    capePct30y: Math.round(percentileOf(current.cape, last30) ?? 0),
    capeMedianAll: median(all),
    capeMedian30y: median(last30),
    ecy: ecyCurrent === null ? null : Math.round(ecyCurrent * 100) / 100,
    ecyPct30y: ecyCurrent === null ? null : Math.round(percentileOf(ecyCurrent, ecyRows.slice(-360).map((r) => r.ecy)) ?? 0),
    buckets: capeBuckets(rows, current.cape),
    holding: holdingStats(rows),
    highs: highStats(rows),
    nearHighNow: flags[flags.length - 1] ?? false,
    capeSeries: downsample(withCape.filter((r) => r.date >= '1900').map((r) => ({ t: r.date, v: r1(r.cape) }))),
  }
}

/** Il CAPE come MarketSignal, per avere il suo grafico tra gli indicatori azionari. */
export function capeSignal(ev: EquityEvidence): MarketSignal {
  const [y, m] = ev.asOf.split('-').map(Number)
  return {
    ...buildPercentileSignal({
      code: 'equities.cape',
      title: 'CAPE di Shiller (borsa USA)',
      value: ev.cape,
      unit: '',
      history: [],
      window: `storia dal ${ev.firstYear + 10}`,
      source: 'Robert Shiller (Yale)',
      asOf: Math.floor(Date.UTC(y, m - 1, 1) / 1000),
      noun: 'valutazioni',
      series: ev.capeSeries,
    }),
    percentile: ev.capePctAll,
    level: ev.capePctAll >= 90 ? 'high' : ev.capePctAll <= 10 ? 'low' : 'normal',
    levelText: ev.capePctAll >= 90 ? 'Valutazioni storicamente elevate' : ev.capePctAll <= 10 ? 'Valutazioni storicamente basse' : 'Valutazioni nella norma storica',
    explanation: `Il CAPE è a ${ev.cape.toLocaleString('it-IT')}: più alto del ${ev.capePctAll}% dei mesi dal ${ev.firstYear + 10} (mediana storica ${ev.capeMedianAll.toLocaleString('it-IT')}, ultimi 30 anni ${ev.capeMedian30y.toLocaleString('it-IT')}).`,
  }
}
