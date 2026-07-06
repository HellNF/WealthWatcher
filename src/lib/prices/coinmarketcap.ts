// src/lib/prices/coinmarketcap.ts — CoinMarketCap adapter (fallback crypto).
// Attivo solo se COINMARKETCAP_KEY è impostata. Ritorna null/[] altrimenti.
// Implementa PriceProvider: mai lancia eccezioni.
import type { PriceProvider, Quote } from './provider'
import type { PricePoint } from './yahoo'

const BASE = 'https://pro-api.coinmarketcap.com'

const PERIOD_DAYS: Record<string, number> = {
  '1m': 30, '3m': 90, '6m': 180, '1y': 365, '5y': 1825,
}

/**
 * Storico OHLCV giornaliero da CoinMarketCap.
 * Richiede piano Hobbyist o superiore; ritorna [] su piano Basic o senza chiave.
 */
export async function getCoinHistoryCMC(
  symbol: string,
  period: string,
): Promise<PricePoint[]> {
  const key = process.env.COINMARKETCAP_KEY
  if (!key) return []

  const ticker = symbol.replace(/-EUR$/, '').replace(/-USD$/, '').toUpperCase()
  const count  = PERIOD_DAYS[period] ?? 90

  try {
    const url = `${BASE}/v1/cryptocurrency/ohlcv/historical?symbol=${encodeURIComponent(ticker)}&convert=EUR&count=${count}&interval=daily`
    const res = await fetch(url, {
      headers: { 'X-CMC_PRO_API_KEY': key },
      next:    { revalidate: 1800 },
    })
    if (!res.ok) {
      console.warn(`[coinmarketcap] getCoinHistoryCMC HTTP ${res.status} per "${ticker}"`)
      return []
    }
    const data = await res.json() as {
      data?:   { quotes?: Array<{ time_close: string; quote?: { EUR?: { close?: number } } }> }
      status?: { error_message?: string }
    }
    const quotes = data.data?.quotes ?? []
    if (quotes.length === 0) {
      const msg = data.status?.error_message
      console.warn(`[coinmarketcap] Nessun dato storico per "${ticker}"${msg ? `: ${msg}` : ''}`)
      return []
    }
    return quotes
      .filter(q => q.quote?.EUR?.close != null)
      .map(q => ({
        date:  q.time_close.slice(0, 10),
        close: q.quote!.EUR!.close!,
      }))
  } catch (e) {
    console.warn(`[coinmarketcap] Errore in getCoinHistoryCMC per "${ticker}":`, e)
    return []
  }
}

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
