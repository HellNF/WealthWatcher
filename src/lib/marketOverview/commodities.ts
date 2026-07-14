// src/lib/marketOverview/commodities.ts — Segnali commodities: prezzo corrente
// vs percentile a 10 anni. Le materie prime sono relativamente mean-reverting
// (a differenza degli indici azionari, che tendono a salire nominalmente nel
// tempo), quindi il percentile del prezzo sul decennio è un indicatore onesto
// e standard ("oro vicino ai massimi del decennio", "petrolio ai minimi"). Dati
// dai futures Yahoo, riusando l'adapter storico esistente.
import { getHistoricalPricesRange } from '@/lib/prices/yahoo'
import { buildPercentileSignal, type MarketSignal } from './signals'

interface CommoditySpec {
  code:   string
  title:  string
  symbol: string // ticker futures Yahoo
}

const COMMODITIES: CommoditySpec[] = [
  { code: 'commodities.gold',   title: 'Oro',           symbol: 'GC=F' },
  { code: 'commodities.silver', title: 'Argento',       symbol: 'SI=F' },
  { code: 'commodities.oil',    title: 'Petrolio (Brent)', symbol: 'BZ=F' },
  { code: 'commodities.copper', title: 'Rame',          symbol: 'HG=F' },
  { code: 'commodities.natgas', title: 'Gas naturale',  symbol: 'NG=F' },
]

function tenYearsAgoIso(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 10)
  return d.toISOString().slice(0, 10)
}

async function fetchCommodity(spec: CommoditySpec): Promise<MarketSignal | null> {
  const { points, currency } = await getHistoricalPricesRange(spec.symbol, tenYearsAgoIso(), new Date().toISOString().slice(0, 10))
  if (points.length < 250) {
    // Meno di ~1 anno di dati: percentile non affidabile → nessun segnale
    // (meglio omettere che mostrare un dato debole).
    console.warn(`[market] commodities: storico insufficiente per ${spec.symbol} (${points.length} punti)`)
    return null
  }
  const closes  = points.map((p) => p.close)
  const last    = points[points.length - 1]
  const asOf    = Math.floor(new Date(last.date).getTime() / 1000)

  return buildPercentileSignal({
    code:    spec.code,
    title:   spec.title,
    value:   Math.round(last.close * 100) / 100,
    unit:    currency ?? 'USD',
    history: closes,
    window:  '10 anni',
    source:  'Yahoo Finance',
    asOf,
    noun:    'prezzo',
    series:  points.map((p) => ({ t: p.date, v: Math.round(p.close * 100) / 100 })),
  })
}

export async function getCommoditySignals(): Promise<MarketSignal[]> {
  const results = await Promise.all(COMMODITIES.map(fetchCommodity))
  return results.filter((s): s is MarketSignal => s !== null)
}
