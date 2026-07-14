// src/lib/marketOverview/analysis/seriesMetrics.ts — Metriche derivate da una
// serie di chiusure giornaliere (~1 anno), condivise da azionario e commodities.
import { getHistoricalPricesRange } from '@/lib/prices/yahoo'

export interface TrendMetrics {
  price:        number | null
  high52:       number | null
  drawdownPct:  number | null   // % sotto il massimo 52 settimane (0 = al massimo)
  pctFromMA200: number | null   // % rispetto alla media a 200 giorni
  momentumPct:  number | null   // rendimento sull'intera finestra (~12m)
  points:       { t: string; v: number }[]
}

const EMPTY: TrendMetrics = { price: null, high52: null, drawdownPct: null, pctFromMA200: null, momentumPct: null, points: [] }

/** Calcola le metriche di trend da una serie di chiusure ordinate. */
export function trendFromCloses(closes: number[], dates: string[]): TrendMetrics {
  if (closes.length < 100) return { ...EMPTY }
  const price = closes[closes.length - 1]
  const high52 = Math.max(...closes)
  const drawdownPct = high52 > 0 ? ((high52 - price) / high52) * 100 : null

  const ma200src = closes.slice(-200)
  const ma200 = ma200src.reduce((s, v) => s + v, 0) / ma200src.length
  const pctFromMA200 = ma200 > 0 ? ((price - ma200) / ma200) * 100 : null

  const first = closes[0]
  const momentumPct = first > 0 ? ((price - first) / first) * 100 : null

  return {
    price,
    high52,
    drawdownPct: drawdownPct === null ? null : Math.round(drawdownPct * 10) / 10,
    pctFromMA200: pctFromMA200 === null ? null : Math.round(pctFromMA200 * 10) / 10,
    momentumPct: momentumPct === null ? null : Math.round(momentumPct * 10) / 10,
    points: closes.map((v, i) => ({ t: dates[i], v })),
  }
}

/** Fetch di ~1 anno di daily da Yahoo e relative metriche di trend. Null-safe. */
export async function fetchTrendMetrics(symbol: string): Promise<TrendMetrics> {
  const from = new Date(); from.setFullYear(from.getFullYear() - 1)
  const { points } = await getHistoricalPricesRange(symbol, from.toISOString().slice(0, 10), new Date().toISOString().slice(0, 10))
  if (points.length === 0) return { ...EMPTY }
  return trendFromCloses(points.map((p) => p.close), points.map((p) => p.date))
}
