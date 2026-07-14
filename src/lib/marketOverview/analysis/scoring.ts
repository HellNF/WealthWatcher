// src/lib/marketOverview/analysis/scoring.ts — Motore di sintesi TRASPARENTE.
//
// Ogni driver produce un punteggio in [-1,+1] dove **+1 = condizioni
// storicamente favorevoli a un ingresso, −1 = sfavorevoli**. Le convenzioni di
// segno sono fisse, documentate e revisionabili qui: nessun modello opaco.
// I punteggi si aggregano in una media pesata rinormalizzata sui driver
// effettivamente disponibili (se un dato manca, il suo peso si ridistribuisce).
//
// IMPORTANTE: questi punteggi descrivono il CONTESTO rispetto allo storico, non
// una previsione. "Favorevole all'ingresso" = "storicamente a questi livelli le
// condizioni erano più distese", mai "salirà".
import type { Driver, Reading, Stance, Confidence, SectorAnalysis, LearnMore } from './types'

export function clamp(x: number, lo = -1, hi = 1): number {
  return Math.max(lo, Math.min(hi, x))
}

/** Lettura qualitativa a partire dal punteggio. */
export function readingFromScore(score: number): Reading {
  if (!Number.isFinite(score)) return 'neutral'
  if (score >= 0.2) return 'favorable'
  if (score <= -0.2) return 'unfavorable'
  return 'neutral'
}

// ── Aggregazione ────────────────────────────────────────────────────────────

/** Media pesata rinormalizzata sui soli driver con dato valido (peso>0, score finito). */
export function aggregate(drivers: Driver[]): number {
  const present = drivers.filter((d) => Number.isFinite(d.score) && d.weight > 0)
  const wsum = present.reduce((s, d) => s + d.weight, 0)
  if (wsum === 0) return 0
  return clamp(present.reduce((s, d) => s + d.score * d.weight, 0) / wsum)
}

// Soglie fisse stance. Volutamente conservative: "accumulate"/"caution" solo
// quando il quadro è nettamente sbilanciato.
export function stanceFromScore(score: number): Stance {
  if (score >= 0.4)  return 'accumulate'
  if (score >= 0.15) return 'lean-accumulate'
  if (score > -0.15) return 'neutral'
  if (score > -0.4)  return 'lean-caution'
  return 'caution'
}

export function confidenceFromCoverage(present: number, total: number): Confidence {
  if (total === 0) return 'bassa'
  const r = present / total
  if (r >= 0.8) return 'alta'
  if (r >= 0.5) return 'media'
  return 'bassa'
}

export const STANCE_HEADLINE: Record<Stance, string> = {
  accumulate:        'Contesto storicamente favorevole all’accumulo',
  'lean-accumulate': 'Contesto moderatamente favorevole',
  neutral:           'Contesto neutro',
  'lean-caution':    'Contesto che invita a una certa cautela',
  caution:           'Contesto teso — cautela',
}

/** Costruisce il paragrafo argomentato: tensione tra fattori pro e contro. */
export function buildNarrative(
  title:    string,
  stance:   Stance,
  drivers:  Driver[],
  historicalNote?: string,
): string {
  const valid = drivers.filter((d) => Number.isFinite(d.score) && d.weight > 0)
  // Non abbassiamo il case: molti label sono nomi propri (BTP, USA, VIX).
  const pros = valid.filter((d) => d.reading === 'favorable').map((d) => d.label)
  const cons = valid.filter((d) => d.reading === 'unfavorable').map((d) => d.label)

  const parts: string[] = [`${title}: ${STANCE_HEADLINE[stance].toLowerCase()}.`]
  if (pros.length) parts.push(`A favore di un ingresso: ${listIt(pros)}.`)
  if (cons.length) parts.push(`Motivi di cautela: ${listIt(cons)}.`)
  if (!pros.length && !cons.length) parts.push('Gli indicatori disponibili non mostrano squilibri marcati rispetto allo storico.')
  if (historicalNote) parts.push(historicalNote)
  parts.push('Valutazione generale di contesto, non un’indicazione personalizzata.')
  return parts.join(' ')
}

function listIt(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}

/** Assembla la SectorAnalysis calcolando score/stance/confidence/narrativa. */
export function synthesize(params: {
  key:        string
  title:      string
  drivers:    Driver[]
  asOf:       number
  learnMore?: LearnMore[]
  historicalNote?: string
  subMarkets?: SectorAnalysis[]
}): SectorAnalysis {
  const score = aggregate(params.drivers)
  const stance = stanceFromScore(score)
  const present = params.drivers.filter((d) => Number.isFinite(d.score) && d.weight > 0).length
  const confidence = confidenceFromCoverage(present, params.drivers.length)
  return {
    key:        params.key,
    title:      params.title,
    stance,
    score:      Math.round(score * 100) / 100,
    confidence,
    headline:   STANCE_HEADLINE[stance],
    narrative:  buildNarrative(params.title, stance, params.drivers, params.historicalNote),
    drivers:    params.drivers,
    learnMore:  params.learnMore ?? [],
    asOf:       params.asOf,
    ...(params.subMarkets ? { subMarkets: params.subMarkets } : {}),
  }
}

// ── Builder dei driver (encapsulano le convenzioni di segno) ──────────────────
// Ognuno accetta un valore eventualmente null/NaN: in tal caso ritorna un driver
// "dato non disponibile" (peso 0) così l'assenza è visibile e la confidenza cala.

interface DriverMeta { label: string; source: string; weight: number; signalCode?: string }

function missing(meta: DriverMeta): Driver {
  return { label: meta.label, detail: 'dato non disponibile', reading: 'neutral', score: NaN, weight: 0, source: meta.source, ...(meta.signalCode ? { signalCode: meta.signalCode } : {}) }
}

function make(meta: DriverMeta, score: number, detail: string): Driver {
  return { label: meta.label, detail, reading: readingFromScore(score), score: clamp(score), weight: meta.weight, source: meta.source, ...(meta.signalCode ? { signalCode: meta.signalCode } : {}) }
}

/** Percentile di "carezza" (prezzo/valutazione): alto = caro = sfavorevole. */
export function driverPricePercentile(meta: DriverMeta, percentile: number | null, window: string): Driver {
  if (percentile === null || !Number.isFinite(percentile)) return missing(meta)
  return make(meta, -(percentile - 50) / 50, `${Math.round(percentile)}° percentile (${window})`)
}

/** Percentile del rendimento (bond): alto = più reddito = favorevole. */
export function driverYieldPercentile(meta: DriverMeta, percentile: number | null, window: string): Driver {
  if (percentile === null || !Number.isFinite(percentile)) return missing(meta)
  return make(meta, (percentile - 50) / 50, `${Math.round(percentile)}° percentile (${window})`)
}

/** Rendimento reale (nominale − inflazione): positivo/alto = favorevole. */
export function driverRealYield(meta: DriverMeta, realPct: number | null): Driver {
  if (realPct === null || !Number.isFinite(realPct)) return missing(meta)
  return make(meta, clamp(realPct / 3), `${realPct.toFixed(1)}% reale (10Y − inflazione)`)
}

/** Pendenza curva 10Y−2Y: inversione (negativa) = cautela; positiva = sana. */
export function driverCurveSlope(meta: DriverMeta, slopePct: number | null): Driver {
  if (slopePct === null || !Number.isFinite(slopePct)) return missing(meta)
  const score = slopePct >= 0 ? Math.min(slopePct / 2, 0.3) : Math.max(slopePct, -1)
  return make(meta, score, `curva ${slopePct >= 0 ? '+' : ''}${slopePct.toFixed(2)}pp (10Y−2Y)`)
}

/** Spread di credito (es. BTP-Bund) in punti base: ampio = più rischio. */
export function driverSpread(meta: DriverMeta, spreadBps: number | null): Driver {
  if (spreadBps === null || !Number.isFinite(spreadBps)) return missing(meta)
  return make(meta, clamp((150 - spreadBps) / 150, -1, 0.4), `${Math.round(spreadBps)} pb di spread`)
}

/** Distanza % dai massimi 52w: ai massimi = ingresso meno favorevole; drawdown = più favorevole. */
export function driverDrawdown(meta: DriverMeta, drawdownPct: number | null): Driver {
  if (drawdownPct === null || !Number.isFinite(drawdownPct)) return missing(meta)
  return make(meta, clamp((drawdownPct - 5) / 25), `${drawdownPct.toFixed(1)}% sotto i max 52w`)
}

/** Distanza % dalla media 200gg: molto sopra = esteso; sotto = potenziale sconto. */
export function driverTrendVsMA(meta: DriverMeta, pctFromMA: number | null): Driver {
  if (pctFromMA === null || !Number.isFinite(pctFromMA)) return missing(meta)
  return make(meta, clamp(-pctFromMA / 20), `${pctFromMA >= 0 ? '+' : ''}${pctFromMA.toFixed(1)}% vs media 200gg`)
}

/** P/E trailing con bande fisse: cheap≈15, rich≈25. */
export function driverPE(meta: DriverMeta, pe: number | null): Driver {
  if (pe === null || !Number.isFinite(pe) || pe <= 0) return missing(meta)
  return make(meta, clamp((20 - pe) / 10), `P/E ${pe.toFixed(1)}`)
}

/** VIX: alto (paura) = storicamente ingressi migliori; basso (compiacenza) = meno. */
export function driverVix(meta: DriverMeta, vix: number | null): Driver {
  if (vix === null || !Number.isFinite(vix)) return missing(meta)
  return make(meta, clamp((vix - 20) / 20), `VIX ${vix.toFixed(1)}`)
}

/** Momentum (%): estremi positivi = rincorsa/ipercomprato; negativi = sconto. Peso basso. */
export function driverMomentum(meta: DriverMeta, momentumPct: number | null, horizon: string): Driver {
  if (momentumPct === null || !Number.isFinite(momentumPct)) return missing(meta)
  return make(meta, clamp(-momentumPct / 50, -0.6, 0.6), `${momentumPct >= 0 ? '+' : ''}${momentumPct.toFixed(1)}% ${horizon}`)
}

/** Fear & Greed (0-100): avidità estrema = cautela; paura estrema = favorevole. */
export function driverFearGreed(meta: DriverMeta, value: number | null): Driver {
  if (value === null || !Number.isFinite(value)) return missing(meta)
  return make(meta, clamp((50 - value) / 50), `indice ${Math.round(value)}/100`)
}

/** BTC vs media 200 settimane (% sopra): molto sopra = fine ciclo; vicino/sotto = accumulo. */
export function driverBtc200w(meta: DriverMeta, pctAbove: number | null): Driver {
  if (pctAbove === null || !Number.isFinite(pctAbove)) return missing(meta)
  return make(meta, clamp(-pctAbove / 150), `${pctAbove >= 0 ? '+' : ''}${pctAbove.toFixed(0)}% vs media 200sett`)
}

/** Oro vs rendimenti reali: l'oro non rende cedole, quindi rendimenti reali
 *  BASSI/negativi lo favoriscono (minor costo-opportunità), alti lo penalizzano. */
export function driverGoldVsRealYield(meta: DriverMeta, realPct: number | null): Driver {
  if (realPct === null || !Number.isFinite(realPct)) return missing(meta)
  return make(meta, clamp(-realPct / 3), `rendimenti reali ${realPct >= 0 ? '+' : ''}${realPct.toFixed(1)}%`)
}

/** Rapporto oro/argento: molto alto (>80) storicamente = stress/oro caro vs argento. Peso basso. */
export function driverGoldSilver(meta: DriverMeta, ratio: number | null): Driver {
  if (ratio === null || !Number.isFinite(ratio)) return missing(meta)
  return make(meta, clamp((70 - ratio) / 40), `rapporto oro/argento ${ratio.toFixed(0)}`)
}

/** Un sotto-mercato che diventa driver del settore padre (azionario). */
export function driverFromSubMarket(sub: SectorAnalysis, weight: number): Driver {
  return {
    label:   sub.title,
    detail:  sub.headline,
    reading: readingFromScore(sub.score),
    score:   sub.score,
    weight,
    source:  'sintesi',
  }
}
