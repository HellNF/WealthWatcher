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

export interface InstrumentDetails {
  price:    string | null   // current market price as decimal string
  currency: string | null
  ter:      string | null   // annual expense ratio as percentage string, e.g. "0.22"
}

/**
 * Fetch current price + TER (fund expense ratio, ETFs only) for an instrument.
 * Never throws — returns nulls on any failure.
 */
export async function getInstrumentDetails(symbol: string): Promise<InstrumentDetails> {
  let price:    string | null = null
  let currency: string | null = null
  let ter:      string | null = null

  try {
    const yf = await import('yahoo-finance2')

    const quote = await yf.default.quote(symbol)
    const q = quote as { regularMarketPrice?: number; currency?: string }
    if (q.regularMarketPrice != null) price = q.regularMarketPrice.toFixed(6).replace(/\.?0+$/, '')
    if (q.currency)                   currency = q.currency.toUpperCase()

    // TER is only available for funds/ETFs via fundProfile
    try {
      const summary = await yf.default.quoteSummary(symbol, { modules: ['fundProfile'] })
      const fp = (summary as { fundProfile?: { annualReportExpenseRatio?: number } }).fundProfile
      if (fp?.annualReportExpenseRatio != null) {
        // Yahoo returns decimal (0.0022 = 0.22%) — convert to percentage string
        ter = (fp.annualReportExpenseRatio * 100).toFixed(4).replace(/\.?0+$/, '')
      }
    } catch { /* non-fund or field not available */ }

  } catch { /* provider down or invalid symbol */ }

  return { price, currency, ter }
}
