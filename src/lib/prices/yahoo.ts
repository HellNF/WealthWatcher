// src/lib/prices/yahoo.ts — yahoo-finance2 adapter.
// Primary provider: covers ETF, stocks, crypto, FX pairs (unofficial, no API key).
// SPEC §6.1 risk: wrapped behind PriceProvider so it's replaceable without
// touching the domain.
import type { PriceProvider, Quote } from './provider'

export const yahooProvider: PriceProvider = {
  async getQuote(symbol: string): Promise<Quote | null> {
    try {
      // Dynamic import keeps the module server-side only and allows mocking in tests.
      const yf = await import('yahoo-finance2')
      const result = await yf.default.quote(symbol)
      const price    = (result as { regularMarketPrice?: number })?.regularMarketPrice
      const currency = (result as { currency?: string })?.currency
      if (!price || !currency) return null

      return {
        price:    price.toFixed(6).replace(/\.?0+$/, '') || price.toString(),
        currency: currency.toUpperCase(),
        asOf:     Math.floor(Date.now() / 1000),
      }
    } catch {
      return null
    }
  },
}
