// src/lib/prices/index.ts — Price cache + refresh orchestration.
// TTL lazy: refetch only if last_price_at is older than PRICE_TTL_MINUTES.
// Returns stale data + flag if the fetch fails — never throws.
import { sqlite } from '@/db'
import { updateInstrumentPrice } from '@/lib/instruments'
import { listTxns, txnsByInstrument } from '@/lib/investmentTxns'
import { getInstrument } from '@/lib/instruments'
import { recordObservation, getObservation } from '@/lib/prices/observations'
import { yahooProvider }                     from './yahoo'
import { coingeckoProvider, getCoinHistory } from './coingecko'
import { alphaVantageProvider }              from './alphavantage'
import { coinMarketCapProvider, getCoinHistoryCMC } from './coinmarketcap'
import type { PricePoint } from './yahoo'
import type { Instrument } from '@/db/schema'
import type { Quote } from './provider'

const TTL_MINUTES = parseInt(process.env.PRICE_TTL_MINUTES ?? '30', 10)

export interface RefreshResult {
  quote:  Quote | null
  stale:  boolean
  source: string | null
}

/**
 * Storico prezzi per crypto con fallback CoinGecko → CoinMarketCap.
 * Se CoinGecko va in rate-limit (risposta vuota), tenta CMC prima di rinunciare.
 */
export async function getCryptoHistory(
  coinId: string,
  symbol: string,
  period: string,
): Promise<PricePoint[]> {
  return (await getCryptoHistoryWithSource(coinId, symbol, period)).points
}

export async function getCryptoHistoryWithSource(coinId: string, symbol: string, period: string): Promise<{ points: PricePoint[]; source: string; currency: string }> {
  const points = await getCoinHistory(coinId, period)
  if (points.length > 0) return { points, source: 'coingecko', currency: 'EUR' }
  return { points: await getCoinHistoryCMC(symbol, period), source: 'coinmarketcap', currency: 'EUR' }
}

/**
 * Resolve a single quote for an instrument using its configured source,
 * with an ordered fallback chain. Returns null if all sources fail.
 */
export async function resolveQuote(instrument: Instrument): Promise<Quote | null> {
  const { price_source, symbol, provider_symbol } = instrument

  // Primary: configured source
  const providers: Array<{ source: string; fetch: () => Promise<Quote | null> }> = []

  if (price_source === 'yahoo') {
    providers.push({ source: 'yahoo', fetch: () => yahooProvider.getQuote(symbol, provider_symbol) })
    if (instrument.cluster === 'crypto') {
      providers.push({ source: 'coingecko', fetch: () => coingeckoProvider.getQuote(symbol, provider_symbol) })
    }
  } else if (price_source === 'coingecko') {
    providers.push({ source: 'coingecko', fetch: () => coingeckoProvider.getQuote(symbol, provider_symbol) })
    providers.push({ source: 'coinmarketcap', fetch: () => coinMarketCapProvider.getQuote(symbol, provider_symbol) })
    providers.push({ source: 'yahoo', fetch: () => yahooProvider.getQuote(symbol, provider_symbol) })
  } else if (price_source === 'alphavantage') {
    providers.push({ source: 'alphavantage', fetch: () => alphaVantageProvider.getQuote(symbol, provider_symbol) })
    providers.push({ source: 'yahoo', fetch: () => yahooProvider.getQuote(symbol, provider_symbol) })
  } else {
    // 'manual' — no fetch
    return null
  }

  for (const provider of providers) {
    try {
      const q = await provider.fetch()
      if (q && Number.isFinite(Number(q.price)) && Number(q.price) > 0
          && q.currency === instrument.currency && Number.isFinite(q.asOf)
          && q.asOf > 0 && q.asOf <= Date.now() / 1000 + 300) {
        return { ...q, source: provider.source }
      }
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
  const observation = getObservation(instrument.id, instrument.last_price_at, instrument.last_price)
  const cachedSource = observation?.source ?? null
  const nowEpoch = Math.floor(Date.now() / 1000)
  const ttlSeconds = TTL_MINUTES * 60
  const isStale =
    !instrument.last_price_at ||
    nowEpoch - instrument.last_price_at > ttlSeconds

  if (!options.force && instrument.last_price && (!isStale || (observation && nowEpoch - observation.retrieved_at < ttlSeconds))) {
    return {
      quote: { price: instrument.last_price, currency: instrument.currency, asOf: instrument.last_price_at! },
      stale: isStale,
      source: cachedSource,
    }
  }

  const quote = await resolveQuote(instrument)
  if (quote) {
    const accepted = sqlite.transaction(() => {
      // Re-read after network I/O: a concurrent refresh may already have a newer quote.
      const current = getInstrument(instrument.id)
      if (!current || (current.last_price_at && quote.asOf < current.last_price_at)) return false
      updateInstrumentPrice(instrument.id, quote.price, quote.asOf)
      recordObservation(instrument.id, quote, nowEpoch)
      return true
    })()
    if (accepted) return { quote, stale: nowEpoch - quote.asOf > ttlSeconds, source: quote.source ?? null }
  }

  const current = getInstrument(instrument.id) ?? instrument
  const currentObservation = getObservation(current.id, current.last_price_at, current.last_price)
  return {
    quote: current.last_price
      ? { price: current.last_price, currency: current.currency, asOf: current.last_price_at! }
      : null,
    stale: true,
    source: currentObservation?.source ?? null,
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
