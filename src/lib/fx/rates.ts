// FX rate repository: cache in fx_history, fetch from Frankfurter on miss.
// Fiat currencies only — BTC/ETH are excluded (crypto prices already come in EUR).
import { db, sqlite } from '@/db'
import { fxHistory } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { fetchRates } from './frankfurter'

// Fiat currencies we care about (subset of CURRENCY_DECIMALS, excluding crypto).
const FIAT_CURRENCIES = ['USD', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'JPY']

/**
 * Get the EUR→quote exchange rate for a given date.
 * Returns '1' for EUR→EUR.
 * Returns a decimal string (1 EUR = rate × quote) or null if unavailable.
 * Caches in fx_history on first fetch for a given date.
 */
export async function getRate(date: string, quote: string): Promise<string | null> {
  const q = quote.toUpperCase()
  if (q === 'EUR') return '1'

  // Check cache first (synchronous SQLite read)
  const cached = db
    .select({ rate: fxHistory.rate })
    .from(fxHistory)
    .where(and(eq(fxHistory.date, date), eq(fxHistory.base, 'EUR'), eq(fxHistory.quote, q)))
    .get()

  if (cached) return cached.rate

  // Cache miss — fetch from Frankfurter and store all returned rates for this date
  const rates = await fetchRates(date === todayIso() ? 'latest' : date)
  if (!rates) return null

  // Upsert all rates returned for this date
  const stmt = sqlite.prepare(`
    INSERT INTO fx_history (date, base, quote, rate)
    VALUES (?, 'EUR', ?, ?)
    ON CONFLICT (date, base, quote) DO NOTHING
  `)
  for (const [currency, rate] of Object.entries(rates)) {
    stmt.run(date, currency, rate.toString())
  }

  return rates[q]?.toString() ?? null
}

/**
 * Pre-fetch and cache all fiat rates for a given date.
 * Useful for the daily snapshot job to avoid per-currency API calls.
 */
export async function refreshFxRates(date: string): Promise<void> {
  const rates = await fetchRates(date === todayIso() ? 'latest' : date)
  if (!rates) return

  const stmt = sqlite.prepare(`
    INSERT INTO fx_history (date, base, quote, rate)
    VALUES (?, 'EUR', ?, ?)
    ON CONFLICT (date, base, quote) DO NOTHING
  `)
  for (const currency of FIAT_CURRENCIES) {
    const rate = rates[currency]
    if (rate != null) stmt.run(date, currency, rate.toString())
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
