// src/lib/prices/coingecko.ts — CoinGecko public API adapter (keyless).
// Used as crypto fallback; uses instrument.provider_symbol as CoinGecko coin id
// (e.g. "bitcoin", "ethereum"). Falls back to lowercased symbol if null.
import type { PriceProvider, Quote } from './provider'

const BASE = 'https://api.coingecko.com/api/v3'

export const coingeckoProvider: PriceProvider = {
  async getQuote(symbol: string, providerSymbol?: string | null): Promise<Quote | null> {
    const coinId = (providerSymbol ?? symbol).toLowerCase()
    try {
      const url = `${BASE}/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=eur&include_last_updated_at=true`
      const res = await fetch(url, { next: { revalidate: 0 } })
      if (!res.ok) return null
      const data = await res.json() as Record<string, { eur?: number; last_updated_at?: number }>
      const entry = data[coinId]
      if (!entry?.eur) return null

      return {
        price:    entry.eur.toString(),
        currency: 'EUR',
        asOf:     entry.last_updated_at ?? Math.floor(Date.now() / 1000),
      }
    } catch {
      return null
    }
  },
}
