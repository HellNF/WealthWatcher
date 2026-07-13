// src/lib/prices/alphavantage.ts — Alpha Vantage adapter (optional).
// Active only if ALPHA_VANTAGE_KEY env is set. Free tier: 25 req/day.
import type { PriceProvider, Quote } from './provider'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'

const BASE = 'https://www.alphavantage.co/query'

export const alphaVantageProvider: PriceProvider = {
  async getQuote(symbol: string): Promise<Quote | null> {
    const key = process.env.ALPHA_VANTAGE_KEY
    if (!key) return null

    try {
      const url = `${BASE}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${key}`
      const res = await fetchWithTimeout(url, { next: { revalidate: 0 } })
      if (!res.ok) return null
      const data = await res.json() as { 'Global Quote'?: { '05. price'?: string; '07. latest trading day'?: string } }
      const gq = data['Global Quote']
      const price = gq?.['05. price']
      if (!price) return null

      return {
        price,
        currency: 'USD', // Alpha Vantage always returns USD for stocks; caller must verify
        asOf:     Math.floor(Date.now() / 1000),
      }
    } catch {
      return null
    }
  },
}
