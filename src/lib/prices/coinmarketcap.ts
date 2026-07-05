// src/lib/prices/coinmarketcap.ts — CoinMarketCap adapter (fallback crypto).
// Attivo solo se COINMARKETCAP_KEY è impostata. Ritorna null altrimenti.
// Implementa PriceProvider: mai lancia eccezioni.
import type { PriceProvider, Quote } from './provider'

const BASE = 'https://pro-api.coinmarketcap.com'

export const coinMarketCapProvider: PriceProvider = {
  async getQuote(symbol: string): Promise<Quote | null> {
    const key = process.env.COINMARKETCAP_KEY
    if (!key) return null   // provider disabilitato — nessun errore

    const ticker = symbol.replace(/-EUR$/, '').replace(/-USD$/, '').toUpperCase()
    try {
      const url = `${BASE}/v1/cryptocurrency/quotes/latest?symbol=${encodeURIComponent(ticker)}&convert=EUR`
      const res = await fetch(url, {
        headers: { 'X-CMC_PRO_API_KEY': key },
        next: { revalidate: 0 },
      })
      if (!res.ok) {
        console.warn(`[coinmarketcap] HTTP ${res.status} per simbolo "${ticker}"`)
        return null
      }
      const data = await res.json() as {
        data?: Record<string, { quote?: { EUR?: { price?: number; last_updated?: string } } }>
        status?: { error_message?: string }
      }
      const entry = data.data?.[ticker]
      const price = entry?.quote?.EUR?.price
      if (price == null) {
        const errMsg = data.status?.error_message
        console.warn(`[coinmarketcap] Prezzo non trovato per "${ticker}"${errMsg ? `: ${errMsg}` : ''}`)
        return null
      }
      const lastUpdated = entry?.quote?.EUR?.last_updated
      const asOf = lastUpdated
        ? Math.floor(new Date(lastUpdated).getTime() / 1000)
        : Math.floor(Date.now() / 1000)

      return {
        price:    price.toString(),
        currency: 'EUR',
        asOf,
      }
    } catch (e) {
      console.warn(`[coinmarketcap] Errore di rete per simbolo "${ticker}":`, e)
      return null
    }
  },
}
