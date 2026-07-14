// src/lib/marketOverview/bonds.ts — Rendimenti dei titoli di Stato a 10 anni per
// paese (percentile su 10 anni). Fonte: BCE / ECB Data Portal (gratuito,
// keyless). Serie "Long-term interest rate for convergence purposes" (10Y),
// mensile. I rendimenti non trendano perpetuamente come gli indici azionari →
// il percentile sul decennio è un indicatore onesto e standard ("BTP ai massimi
// del decennio", "rendimenti compressi").
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'
import { buildPercentileSignal, type MarketSignal } from './signals'

interface CountrySpec {
  code:    string
  title:   string
  refArea: string // codice ISO paese per il dataset ECB
}

const COUNTRIES: CountrySpec[] = [
  { code: 'bonds.it10y', title: 'BTP Italia 10 anni',    refArea: 'IT' },
  { code: 'bonds.de10y', title: 'Bund Germania 10 anni', refArea: 'DE' },
  { code: 'bonds.es10y', title: 'Bonos Spagna 10 anni',  refArea: 'ES' },
  { code: 'bonds.fr10y', title: 'OAT Francia 10 anni',   refArea: 'FR' },
]

export interface Observation {
  period: string // YYYY-MM o YYYY-MM-DD
  value:  number
}

const ECB_ROOT = 'https://data-api.ecb.europa.eu/service/data'

/**
 * Fetch generico di una serie ECB (dataset + chiave), ultime `lastN`
 * osservazioni, ordinate crescenti. Ritorna [] su qualsiasi errore (mai lancia).
 * Il formato csvdata ha sempre le colonne TIME_PERIOD/OBS_VALUE → un solo parser.
 */
export async function fetchEcb(dataset: string, seriesKey: string, lastN = 120): Promise<Observation[]> {
  const url = `${ECB_ROOT}/${dataset}/${seriesKey}?lastNObservations=${lastN}&format=csvdata`
  try {
    const res = await fetchWithTimeout(url, { headers: { Accept: 'text/csv' }, cache: 'no-store' })
    if (!res.ok) {
      console.warn(`[market] ECB ${dataset}/${seriesKey} → HTTP ${res.status}`)
      return []
    }
    return parseEcbCsv(await res.text())
  } catch (e) {
    console.warn(`[market] ECB ${dataset}/${seriesKey} errore di rete:`, e instanceof Error ? e.message : e)
    return []
  }
}

/** Rendimento 10Y "convergence" per paese (mensile, ~10 anni). */
function fetchEcbSeries(refArea: string): Promise<Observation[]> {
  return fetchEcb('IRS', `M.${refArea}.L.L40.CI.0000.EUR.N.Z`)
}

/** Parser CSV minimale del formato csvdata dell'ECB (colonne TIME_PERIOD, OBS_VALUE). */
function parseEcbCsv(csv: string): Observation[] {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []
  const header = lines[0].split(',')
  const iPeriod = header.indexOf('TIME_PERIOD')
  const iValue  = header.indexOf('OBS_VALUE')
  if (iPeriod === -1 || iValue === -1) return []

  const obs: Observation[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const period = cols[iPeriod]
    const value  = parseFloat(cols[iValue])
    if (period && Number.isFinite(value)) obs.push({ period, value })
  }
  // Ordina per periodo crescente così l'ultimo è il più recente.
  obs.sort((a, b) => a.period.localeCompare(b.period))
  return obs
}

async function fetchCountry(spec: CountrySpec): Promise<MarketSignal | null> {
  const series = await fetchEcbSeries(spec.refArea)
  if (series.length < 24) {
    console.warn(`[market] bonds: storico insufficiente per ${spec.refArea} (${series.length} osservazioni)`)
    return null
  }
  const values = series.map((o) => o.value)
  const latest = series[series.length - 1]
  const asOf   = Math.floor(new Date(`${latest.period}-01T00:00:00Z`).getTime() / 1000)

  return buildPercentileSignal({
    code:    spec.code,
    title:   spec.title,
    value:   latest.value,
    unit:    '%',
    history: values,
    window:  '10 anni',
    source:  'BCE (ECB Data Portal)',
    asOf,
    noun:    'rendimento',
    series:  series.map((o) => ({ t: o.period, v: o.value })),
  })
}

export async function getBondSignals(): Promise<MarketSignal[]> {
  const results = await Promise.all(COUNTRIES.map(fetchCountry))
  return results.filter((s): s is MarketSignal => s !== null)
}

// ── Macro per la sintesi obbligazionaria (analysis/bonds.ts) ──────────────────

export interface BondMacro {
  it10y:      number | null   // rendimento BTP 10Y (%)
  it10yPct:   number | null   // percentile 10y del BTP
  de10y:      number | null   // Bund 10Y (%)
  spreadBps:  number | null   // spread BTP-Bund in punti base
  curve2y:    number | null   // euro area AAA 2Y spot (%)
  curve10y:   number | null   // euro area AAA 10Y spot (%)
  slope:      number | null   // 10Y − 2Y (punti percentuali)
  inflation:  number | null   // HICP annuo euro (%)
  realYield:  number | null   // BTP 10Y − inflazione (%)
  asOf:       number
}

function percentileOfLatest(series: Observation[]): number | null {
  if (series.length < 24) return null
  const values = series.map((o) => o.value)
  const latest = values[values.length - 1]
  const loe = values.reduce((n, v) => (v <= latest ? n + 1 : n), 0)
  return (loe / values.length) * 100
}

/**
 * Raccoglie in parallelo i dati macro obbligazionari euro: livello e percentile
 * del BTP, spread verso il Bund, pendenza della curva AAA (2Y/10Y) e rendimento
 * reale (al netto dell'inflazione HICP). Ogni campo è null-safe.
 */
export async function getBondMacro(): Promise<BondMacro> {
  const [it, de, yc2, yc10, hicp] = await Promise.all([
    fetchEcbSeries('IT'),
    fetchEcbSeries('DE'),
    fetchEcb('YC', 'B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y', 30),
    fetchEcb('YC', 'B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y', 30),
    fetchEcb('ICP', 'M.U2.N.000000.4.ANR', 24),
  ])

  const last = (s: Observation[]) => (s.length ? s[s.length - 1].value : null)
  const it10y = last(it)
  const de10y = last(de)
  const curve2y = last(yc2)
  const curve10y = last(yc10)
  const inflation = last(hicp)

  const spreadBps = it10y !== null && de10y !== null ? (it10y - de10y) * 100 : null
  const slope = curve10y !== null && curve2y !== null ? curve10y - curve2y : null
  const realYield = it10y !== null && inflation !== null ? it10y - inflation : null

  return {
    it10y,
    it10yPct: percentileOfLatest(it),
    de10y,
    spreadBps,
    curve2y,
    curve10y,
    slope,
    inflation,
    realYield,
    asOf: Math.floor(Date.now() / 1000),
  }
}
