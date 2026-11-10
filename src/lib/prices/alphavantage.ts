// src/lib/prices/alphavantage.ts — Alpha Vantage adapter (optional).
// Active only if ALPHA_VANTAGE_KEY env is set. Free tier: 25 req/day.
import type { PriceProvider, Quote } from './provider'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'

const currencies = new Map<string, { currency: string; at: number }>()

const BASE = 'https://www.alphavantage.co/query'

export const alphaVantageProvider: PriceProvider = {
  async getQuote(symbol: string): Promise<Quote | null> {
    const key = process.env.ALPHA_VANTAGE_KEY
    if (!key) return null

    try {
      let metadata = currencies.get(symbol)
      if (!metadata || Date.now() - metadata.at > 86_400_000) {
        const response = await fetchWithTimeout(`${BASE}?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(symbol)}&apikey=${key}`, { cache: 'no-store' })
        if (!response.ok) return null
        const search = await response.json() as { bestMatches?: Array<{ '1. symbol': string; '8. currency': string }> }
        const exact = search.bestMatches?.filter((m) => m['1. symbol'] === symbol) ?? []
        if (exact.length !== 1 || !/^[A-Z]{3}$/.test(exact[0]['8. currency'])) return null
        metadata = { currency: exact[0]['8. currency'], at: Date.now() }
        currencies.set(symbol, metadata)
      }
      const url = `${BASE}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${key}`
      const res = await fetchWithTimeout(url, { next: { revalidate: 0 } })
      if (!res.ok) return null
      const data = await res.json() as { 'Global Quote'?: { '05. price'?: string; '07. latest trading day'?: string } }
      const gq = data['Global Quote']
      const price = gq?.['05. price']
      const day = gq?.['07. latest trading day']
      if (!price || !day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
      const observedAt = Date.parse(`${day}T00:00:00Z`) / 1000
      if (!Number.isFinite(observedAt)) return null

      return {
        price,
        kind: 'close',
        currency: metadata.currency,
        asOf:     observedAt, // daily observation, not retrieval time
      }
    } catch {
      return null
    }
  },
}
