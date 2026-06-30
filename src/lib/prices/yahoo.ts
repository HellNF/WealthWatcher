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
// Yahoo Finance restituisce alcuni prezzi in subunità (es. azioni LSE in GBp = pence).
// Normalizza: GBp → GBP dividendo per 100; ILA → ILS, ZAc → ZAR, etc.
const SUBUNIT_MAP: Record<string, { major: string; factor: number }> = {
  GBp: { major: 'GBP', factor: 100 },
  ILA: { major: 'ILS', factor: 100 },
  ZAc: { major: 'ZAR', factor: 100 },
}

function normalizeCurrencyAndPrice(
  rawCurrency: string,
  rawPrice:    number,
): { price: number; currency: string } {
  const sub = SUBUNIT_MAP[rawCurrency]
  if (sub) return { price: rawPrice / sub.factor, currency: sub.major }
  return { price: rawPrice, currency: rawCurrency.toUpperCase() }
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

    // Strategia 1: quote() — funziona per ETF, azioni, crypto
    try {
      const quote = await yf.default.quote(symbol)
      const q = quote as { regularMarketPrice?: number; currency?: string }
      if (q.regularMarketPrice && q.currency) {
        const norm = normalizeCurrencyAndPrice(q.currency, q.regularMarketPrice)
        price    = norm.price.toFixed(6).replace(/\.?0+$/, '')
        currency = norm.currency
      }
    } catch { /* quote() non disponibile per questo ticker */ }

    // Strategia 2: quoteSummary[price] — necessario per fondi comuni (0P... tickers)
    // dove regularMarketPrice è null/0 nel modulo quote standard
    if (!price) {
      try {
        const summary = await yf.default.quoteSummary(symbol, { modules: ['price'] })
        const p = (summary as {
          price?: { regularMarketPrice?: number; currency?: string }
        }).price
        if (p?.regularMarketPrice && p?.currency) {
          const norm = normalizeCurrencyAndPrice(p.currency, p.regularMarketPrice)
          price    = norm.price.toFixed(6).replace(/\.?0+$/, '')
          currency = norm.currency
        }
      } catch { /* anche quoteSummary fallito */ }
    }

    // TER via fundProfile (ETF e fondi comuni)
    try {
      const summary = await yf.default.quoteSummary(symbol, { modules: ['fundProfile'] })
      const fp = (summary as { fundProfile?: { annualReportExpenseRatio?: number } }).fundProfile
      if (fp?.annualReportExpenseRatio != null) {
        ter = (fp.annualReportExpenseRatio * 100).toFixed(4).replace(/\.?0+$/, '')
      }
    } catch { /* non-fund o campo non disponibile */ }

  } catch { /* provider down o simbolo non valido */ }

  return { price, currency, ter }
}
