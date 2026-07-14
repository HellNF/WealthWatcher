// src/lib/marketOverview/equities.ts — Segnali azionari.
//
// Scelta metodologica (affidabilità): NON usiamo il percentile del PREZZO
// dell'indice sul decennio, perché gli indici azionari tendono a salire
// nominalmente nel tempo → un indice ai massimi sta quasi sempre al ~100°
// percentile per costruzione, il che NON dice nulla sulla convenienza. Usiamo
// invece la distanza dai massimi delle ultime 52 settimane (drawdown), che è un
// segnale oscillante e onesto: dice se il mercato è "ai massimi" o "in
// correzione" rispetto al proprio recente, con soglie fisse documentate.
import { getHistoricalPricesRange } from '@/lib/prices/yahoo'
import { downsample, type MarketSignal, type SignalLevel } from './signals'

interface IndexSpec {
  code:   string
  title:  string
  symbol: string
}

const INDICES: IndexSpec[] = [
  { code: 'equities.sp500',  title: 'S&P 500 (USA)',        symbol: '^GSPC' },
  { code: 'equities.stoxx',  title: 'Euro Stoxx 50 (Area euro)', symbol: '^STOXX50E' },
]

// Soglie fisse sul rapporto prezzo/max-52settimane. Documentate e revisionabili.
// ≥98% del massimo = "ai massimi"; ≤85% = "in correzione"; in mezzo = "sotto i massimi".
const NEAR_HIGH = 0.98
const CORRECTION = 0.85

function classifyDrawdown(pctOfHigh: number): { level: SignalLevel; text: string } {
  if (pctOfHigh >= NEAR_HIGH) return { level: 'high', text: 'Ai massimi delle 52 settimane' }
  if (pctOfHigh <= CORRECTION) return { level: 'low', text: 'In correzione dai massimi' }
  return { level: 'normal', text: 'Sotto i massimi, nella norma' }
}

function oneYearAgoIso(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  return d.toISOString().slice(0, 10)
}

async function fetchIndex(spec: IndexSpec): Promise<MarketSignal | null> {
  const { points } = await getHistoricalPricesRange(spec.symbol, oneYearAgoIso(), new Date().toISOString().slice(0, 10))
  if (points.length < 100) {
    console.warn(`[market] equities: storico insufficiente per ${spec.symbol} (${points.length} punti)`)
    return null
  }
  const closes = points.map((p) => p.close)
  const high52 = Math.max(...closes)
  const last   = points[points.length - 1]
  if (high52 <= 0) return null

  const pctOfHigh = last.close / high52
  const drawdownPct = Math.round((1 - pctOfHigh) * 1000) / 10 // % sotto il massimo, 1 decimale
  const { level, text } = classifyDrawdown(pctOfHigh)
  const asOf = Math.floor(new Date(last.date).getTime() / 1000)

  const explanation =
    drawdownPct <= 0.1
      ? `L'indice è praticamente sul massimo delle ultime 52 settimane: storicamente una fase poco favorevole a nuovi ingressi.`
      : `L'indice è a ${drawdownPct}% sotto il massimo delle ultime 52 settimane.`

  return {
    code:       spec.code,
    title:      spec.title,
    value:      drawdownPct,        // 0 = al massimo; 12.3 = 12,3% sotto il massimo
    unit:       '% dai max',
    percentile: null,               // qui non usiamo percentile (vedi nota sopra)
    window:     '52 settimane',
    level,
    levelText:  text,
    source:     'Yahoo Finance',
    asOf,
    // Il grafico mostra il PREZZO dell'indice nell'anno: si vede la vicinanza
    // al massimo che genera l'etichetta. (value è il drawdown, series è il prezzo.)
    series:     downsample(points.map((p) => ({ t: p.date, v: Math.round(p.close * 100) / 100 }))),
    explanation,
  }
}

export async function getEquitySignals(): Promise<MarketSignal[]> {
  const results = await Promise.all(INDICES.map(fetchIndex))
  return results.filter((s): s is MarketSignal => s !== null)
}
