// EUR conversion helper. Uses the FX rate for the given date (historical accuracy).
// Crypto instruments priced in EUR by CoinGecko pass through as identity.
// Returns null if rate is unavailable (callers mark the snapshot as stale).
import { fromMinor, toMinor, dec } from '@/lib/money'
import { getRate } from './rates'

/**
 * Convert an amount (in minor units of `fromCurrency`) to EUR minor units
 * using the exchange rate for `date` (ISO YYYY-MM-DD).
 *
 * Returns null if the rate is unavailable (e.g. weekend/holiday for exotic
 * currency, network error, or unsupported currency).
 */
export async function convertToEur(
  amountMinor: number,
  fromCurrency: string,
  date: string,
): Promise<number | null> {
  const from = fromCurrency.toUpperCase()
  if (from === 'EUR') return amountMinor

  const rate = await getRate(date, from)
  if (!rate) return null

  // Convert: major_from / rate = major_eur (since 1 EUR = rate × from)
  const majorFrom = fromMinor(amountMinor, from)
  const majorEur  = dec(majorFrom).div(dec(rate))
  return toMinor(majorEur.toFixed(10), 'EUR')
}
