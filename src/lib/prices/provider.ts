// src/lib/prices/provider.ts — Abstract price provider interface.
// All adapters implement PriceProvider. If a source is down or the symbol
// is not found, getQuote returns null (never throws — callers show "stale").

export interface Quote {
  price:    string   // decimal string in the instrument's currency
  currency: string   // ISO-4217 code returned by the provider
  asOf:     number   // unix epoch seconds of the quote
}

export interface PriceProvider {
  getQuote(symbol: string, providerSymbol?: string | null): Promise<Quote | null>
}
