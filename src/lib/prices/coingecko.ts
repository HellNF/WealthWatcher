// src/lib/prices/coingecko.ts — CoinGecko public API adapter (keyless).
// Used as crypto primary source; uses instrument.provider_symbol as CoinGecko coin id
// (e.g. "bitcoin", "ethereum"). Falls back to lowercased symbol if null.
import type { PriceProvider, Quote } from './provider'
import type { PricePoint } from './yahoo'

const BASE = 'https://api.coingecko.com/api/v3'

export const coingeckoProvider: PriceProvider = {
  async getQuote(symbol: string, providerSymbol?: string | null): Promise<Quote | null> {
    const coinId = (providerSymbol ?? symbol).toLowerCase()
    try {
      const url = `${BASE}/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=eur&include_last_updated_at=true`
      const res = await fetch(url, { next: { revalidate: 0 } })
      if (!res.ok) {
        console.warn(`[coingecko] HTTP ${res.status} per coin id "${coinId}"`)
        return null
      }
      const data = await res.json() as Record<string, { eur?: number; last_updated_at?: number }>
      const entry = data[coinId]
      if (!entry?.eur) {
        console.warn(`[coingecko] Coin id "${coinId}" non trovato nella risposta — verifica provider_symbol`)
        return null
      }

      return {
        price:    entry.eur.toString(),
        currency: 'EUR',
        asOf:     entry.last_updated_at ?? Math.floor(Date.now() / 1000),
      }
    } catch (e) {
      console.warn(`[coingecko] Errore di rete per coin id "${coinId}":`, e)
      return null
    }
  },
}

// ── Ricerca monete ─────────────────────────────────────────────────────────────

export interface CoinSearchResult {
  id:     string   // CoinGecko coin id — usato come provider_symbol
  symbol: string   // ticker, es. "BTC"
  name:   string   // nome per esteso, es. "Bitcoin"
  thumb:  string   // URL icona piccola
}

/**
 * Cerca monete su CoinGecko per nome o ticker.
 * Ritorna i primi risultati della sezione "coins".
 * Non lancia mai eccezioni.
 */
export async function searchCoins(query: string): Promise<CoinSearchResult[]> {
  if (!query.trim()) return []
  try {
    const url = `${BASE}/search?query=${encodeURIComponent(query.trim())}`
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) {
      console.warn(`[coingecko] searchCoins HTTP ${res.status} per query "${query}"`)
      return []
    }
    const data = await res.json() as {
      coins?: Array<{ id: string; symbol: string; name: string; thumb: string }>
    }
    return (data.coins ?? []).slice(0, 10).map((c) => ({
      id:     c.id,
      symbol: c.symbol.toUpperCase(),
      name:   c.name,
      thumb:  c.thumb,
    }))
  } catch (e) {
    console.warn(`[coingecko] Errore di rete in searchCoins:`, e)
    return []
  }
}

// ── Storico prezzi ─────────────────────────────────────────────────────────────

const PERIOD_DAYS: Record<string, number> = {
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
  '5y': 1825,
}

/**
 * Recupera lo storico prezzi giornalieri da CoinGecko per un dato coin id.
 * Ritorna punti { date, close } compatibili con PricePoint di yahoo.ts.
 * Non lancia mai eccezioni.
 */
export async function getCoinHistory(
  coinId:  string,
  period:  string,
): Promise<PricePoint[]> {
  const days = PERIOD_DAYS[period] ?? 90
  try {
    const url = `${BASE}/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=eur&days=${days}`
    const res = await fetch(url, { next: { revalidate: 1800 } })
    if (!res.ok) {
      console.warn(`[coingecko] getCoinHistory HTTP ${res.status} per coin id "${coinId}"`)
      return []
    }
    const data = await res.json() as { prices?: [number, number][] }
    const prices = data.prices ?? []

    // CoinGecko restituisce [timestamp_ms, price] ogni ora per ≤90 giorni, giornaliero oltre.
    // Raggruppiamo per data ISO tenendo l'ultimo punto del giorno.
    const byDate = new Map<string, number>()
    for (const [ts, price] of prices) {
      const date = new Date(ts).toISOString().slice(0, 10)
      byDate.set(date, price) // sovrascritura → mantiene l'ultimo punto del giorno
    }

    return Array.from(byDate.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, close]) => ({ date, close }))
  } catch (e) {
    console.warn(`[coingecko] Errore di rete in getCoinHistory per "${coinId}":`, e)
    return []
  }
}
