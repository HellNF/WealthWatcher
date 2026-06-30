// src/lib/prices/index.ts — Price cache + refresh orchestration.
// TTL lazy: refetch only if last_price_at is older than PRICE_TTL_MINUTES.
// Returns stale data + flag if the fetch fails — never throws.
import { updateInstrumentPrice } from '@/lib/instruments'
import { getPortfolioForUser } from '@/lib/portfolios'
import { listTxns, txnsByInstrument } from '@/lib/investmentTxns'
import { getInstrument } from '@/lib/instruments'
import { appendPriceHistory } from '@/lib/priceHistory'
import { yahooProvider }         from './yahoo'
import { coingeckoProvider }     from './coingecko'
import { alphaVantageProvider }  from './alphavantage'
import type { Instrument } from '@/db/schema'
import type { Quote } from './provider'

const TTL_MINUTES = parseInt(process.env.PRICE_TTL_MINUTES ?? '30', 10)

export interface RefreshResult {
  quote:  Quote | null
  stale:  boolean
  source: Instrument['price_source']
}

/**
 * Resolve a single quote for an instrument using its configured source,
 * with an ordered fallback chain. Returns null if all sources fail.
 */
export async function resolveQuote(instrument: Instrument): Promise<Quote | null> {
  const { price_source, symbol, provider_symbol } = instrument

  // Primary: configured source
  const providers: Array<() => Promise<Quote | null>> = []

  if (price_source === 'yahoo') {
    providers.push(() => yahooProvider.getQuote(symbol, provider_symbol))
    if (instrument.cluster === 'crypto') {
      providers.push(() => coingeckoProvider.getQuote(symbol, provider_symbol))
    }
  } else if (price_source === 'coingecko') {
    providers.push(() => coingeckoProvider.getQuote(symbol, provider_symbol))
    providers.push(() => yahooProvider.getQuote(symbol, provider_symbol))
  } else if (price_source === 'alphavantage') {
    providers.push(() => alphaVantageProvider.getQuote(symbol, provider_symbol))
    providers.push(() => yahooProvider.getQuote(symbol, provider_symbol))
  } else {
    // 'manual' — no fetch
    return null
  }

  for (const fn of providers) {
    try {
      const q = await fn()
      if (q) return q
    } catch {
      // continue to next provider
    }
  }
  return null
}

/**
 * Refresh an instrument price if stale or forced.
 * Updates DB on success. Returns current quote + stale flag.
 */
export async function refreshInstrumentPrice(
  instrument: Instrument,
  options: { force?: boolean } = {},
): Promise<RefreshResult> {
  const nowEpoch = Math.floor(Date.now() / 1000)
  const ttlSeconds = TTL_MINUTES * 60
  const isStale =
    !instrument.last_price_at ||
    nowEpoch - instrument.last_price_at > ttlSeconds

  if (!options.force && !isStale && instrument.last_price) {
    return {
      quote: { price: instrument.last_price, currency: instrument.currency, asOf: instrument.last_price_at! },
      stale: false,
      source: instrument.price_source,
    }
  }

  const quote = await resolveQuote(instrument)
  if (quote) {
    updateInstrumentPrice(instrument.id, quote.price, quote.asOf)
    const today = new Date().toISOString().slice(0, 10)
    appendPriceHistory(instrument.id, today, quote.price, quote.currency, instrument.price_source)
    return { quote, stale: false, source: instrument.price_source }
  }

  // Fetch failed — return last known price marked stale
  return {
    quote: instrument.last_price
      ? { price: instrument.last_price, currency: instrument.currency, asOf: instrument.last_price_at! }
      : null,
    stale: true,
    source: instrument.price_source,
  }
}

/**
 * Refresh prices for all distinct instruments in a portfolio.
 * Used by the "Aggiorna prezzi" button in the UI.
 */
export async function refreshPortfolioPrices(
  userId: number,
  portfolioId: number,
): Promise<Map<number, RefreshResult>> {
  // Verify ownership via listTxns (which checks the portfolio)
  const txns = listTxns(userId, portfolioId)
  const grouped = txnsByInstrument(txns)
  const results = new Map<number, RefreshResult>()

  await Promise.all(
    [...grouped.keys()].map(async (instrumentId) => {
      const instrument = getInstrument(instrumentId)
      if (!instrument) return
      const result = await refreshInstrumentPrice(instrument)
      results.set(instrumentId, result)
    }),
  )

  return results
}
