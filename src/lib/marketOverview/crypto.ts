// src/lib/marketOverview/crypto.ts — Segnali crypto: sentiment (Fear & Greed
// Index di alternative.me, keyless) e struttura di mercato (dominance BTC da
// CoinGecko /global, keyless). Il Fear & Greed usa la classificazione UFFICIALE
// della fonte (Extreme Fear … Extreme Greed): non inventiamo etichette.
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'
import { getHistoricalPricesRange } from '@/lib/prices/yahoo'
import { downsample, type MarketSignal, type SignalLevel, type SeriesPoint } from './signals'

// limit=365 → un anno di storico giornaliero per il grafico che spiega il valore.
const FNG_URL = 'https://api.alternative.me/fng/?limit=365'
const CG_GLOBAL_URL = 'https://api.coingecko.com/api/v3/global'

// Traduzione IT della classificazione ufficiale alternative.me + livello neutro.
const FNG_MAP: Record<string, { text: string; level: SignalLevel }> = {
  'Extreme Fear': { text: 'Paura estrema',  level: 'low' },
  'Fear':         { text: 'Paura',          level: 'low' },
  'Neutral':      { text: 'Neutrale',       level: 'normal' },
  'Greed':        { text: 'Avidità',        level: 'high' },
  'Extreme Greed':{ text: 'Avidità estrema',level: 'high' },
}

async function getFearGreed(): Promise<MarketSignal | null> {
  try {
    const res = await fetchWithTimeout(FNG_URL, { cache: 'no-store' })
    if (!res.ok) { console.warn(`[market] Fear&Greed → HTTP ${res.status}`); return null }
    const json = await res.json() as { data?: { value?: string; value_classification?: string; timestamp?: string }[] }
    const rows = json.data ?? []
    const d = rows[0] // il più recente è in testa
    const value = d?.value ? parseInt(d.value, 10) : NaN
    if (!Number.isFinite(value)) return null

    const mapped = d?.value_classification ? FNG_MAP[d.value_classification] : undefined

    // Serie cronologica (la fonte la dà dal più recente al più vecchio → invertiamo).
    const series: SeriesPoint[] = rows
      .filter((r) => r.value && r.timestamp)
      .map((r) => ({ t: new Date(parseInt(r.timestamp!, 10) * 1000).toISOString().slice(0, 10), v: parseInt(r.value!, 10) }))
      .reverse()

    return {
      code:       'crypto.fng',
      title:      'Fear & Greed Index (crypto)',
      value,
      unit:       '/100',
      percentile: null, // l'indice È già una scala 0–100; usiamo la classificazione ufficiale
      window:     'ultimo anno',
      level:      mapped?.level ?? null,
      levelText:  mapped?.text ?? 'Sentiment non classificato',
      source:     'alternative.me',
      asOf:       d?.timestamp ? parseInt(d.timestamp, 10) : Math.floor(Date.now() / 1000),
      series:     series.length > 1 ? downsample(series) : undefined,
      explanation: `Indice di sentiment a ${value}/100. Convenzione della fonte: sotto 25 = paura estrema, sopra 75 = avidità. Il grafico mostra l'andamento dell'ultimo anno.`,
    }
  } catch (e) {
    console.warn('[market] Fear&Greed errore di rete:', e instanceof Error ? e.message : e)
    return null
  }
}

async function getBtcDominance(): Promise<MarketSignal | null> {
  try {
    const res = await fetchWithTimeout(CG_GLOBAL_URL, { cache: 'no-store' })
    if (!res.ok) { console.warn(`[market] CoinGecko /global → HTTP ${res.status}`); return null }
    const json = await res.json() as {
      data?: { market_cap_percentage?: { btc?: number }; updated_at?: number }
    }
    const btc = json.data?.market_cap_percentage?.btc
    if (typeof btc !== 'number') return null

    return {
      code:       'crypto.btc_dominance',
      title:      'Dominanza Bitcoin',
      value:      Math.round(btc * 10) / 10,
      unit:       '%',
      percentile: null, // dato informativo, senza classificazione
      window:     'oggi',
      level:      null,
      levelText:  'Quota di BTC sulla capitalizzazione crypto totale',
      source:     'CoinGecko',
      asOf:       json.data?.updated_at ?? Math.floor(Date.now() / 1000),
    }
  } catch (e) {
    console.warn('[market] CoinGecko /global errore di rete:', e instanceof Error ? e.message : e)
    return null
  }
}

export async function getCryptoSignals(): Promise<MarketSignal[]> {
  const results = await Promise.all([getFearGreed(), getBtcDominance()])
  return results.filter((s): s is MarketSignal => s !== null)
}

// ── Ciclo BTC per la sintesi (analysis/crypto.ts) ─────────────────────────────

export interface BtcCycle {
  price:         number | null
  pctAbove200w:  number | null   // % sopra la media a 200 settimane (posizione nel ciclo)
  momentum90d:   number | null   // variazione % ~90 giorni
  fearGreed:     number | null
  dominance:     number | null
  asOf:          number
}

/**
 * Metriche di ciclo BTC da Yahoo `BTC-USD` (storia lunga keyless): media a 200
 * settimane (≈1400 giorni) e momentum a 90 giorni. Più F&G e dominance già
 * disponibili. Tutto null-safe.
 */
export async function getBtcCycle(): Promise<BtcCycle> {
  const from = new Date(); from.setFullYear(from.getFullYear() - 5)
  const [{ points }, fng, dom] = await Promise.all([
    getHistoricalPricesRange('BTC-USD', from.toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)),
    getFearGreed(),
    getBtcDominance(),
  ])

  let price: number | null = null
  let pctAbove200w: number | null = null
  let momentum90d: number | null = null

  if (points.length > 0) {
    const closes = points.map((p) => p.close)
    price = closes[closes.length - 1]
    const window = closes.slice(-1400) // ~200 settimane di daily
    if (window.length >= 400) {
      const ma = window.reduce((s, v) => s + v, 0) / window.length
      if (ma > 0) pctAbove200w = ((price - ma) / ma) * 100
    }
    if (closes.length > 90) {
      const past = closes[closes.length - 91]
      if (past > 0) momentum90d = ((price - past) / past) * 100
    }
  }

  return {
    price,
    pctAbove200w,
    momentum90d,
    fearGreed: fng ? fng.value : null,
    dominance: dom ? dom.value : null,
    asOf: Math.floor(Date.now() / 1000),
  }
}
