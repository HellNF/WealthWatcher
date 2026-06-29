// src/lib/money.ts — Boundary between storage and business logic for numeric values.
//
// Two domains:
//   Money   — monetary amounts stored as INTEGER minor units (e.g. 1250 = €12.50).
//             SQL SUM/AVG are safe here; no float arithmetic needed.
//   Decimal — quantities, prices, TER, FX rates stored as TEXT decimal strings.
//             JS arithmetic via decimal.js; never use Number for these.
import Decimal from 'decimal.js'

// Bank/half-even rounding, 28 significant digits (handles BTC + EUR conversions)
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_EVEN })

/**
 * Minor units per major unit for supported currencies.
 * Add new ones here as WealthWatcher gains multi-currency support.
 */
const CURRENCY_DECIMALS: Record<string, number> = {
  EUR: 2,
  USD: 2,
  GBP: 2,
  CHF: 2,
  SEK: 2,
  NOK: 2,
  DKK: 2,
  JPY: 0,
  BTC: 8,
  ETH: 8,
}

function decimalsFor(currency: string): number {
  const d = CURRENCY_DECIMALS[currency.toUpperCase()]
  if (d === undefined) throw new Error(`Unsupported currency: ${currency}`)
  return d
}

// ── Money helpers (INTEGER minor units) ───────────────────────────────────────

/**
 * Parse a decimal string (e.g. "12.50") and return integer minor units (e.g. 1250 for EUR).
 * Uses banker's rounding (ROUND_HALF_EVEN); throws on overflow.
 *
 * @example toMinor("12.50", "EUR") → 1250
 * @example toMinor("0.00000001", "BTC") → 1 (1 satoshi)
 */
export function toMinor(decimalString: string, currency: string): number {
  const factor = Decimal.pow(10, decimalsFor(currency))
  const minor = new Decimal(decimalString)
    .times(factor)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_EVEN)
  const n = minor.toNumber()
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(
      `${decimalString} ${currency} → ${n} minor units exceeds safe integer range`,
    )
  }
  return n
}

/**
 * Convert integer minor units back to a fixed-decimal string.
 *
 * @example fromMinor(1250, "EUR") → "12.50"
 * @example fromMinor(1, "BTC")   → "0.00000001"
 */
export function fromMinor(minor: number, currency: string): string {
  const d = decimalsFor(currency)
  return new Decimal(minor).div(Decimal.pow(10, d)).toFixed(d)
}

/**
 * Locale-formatted display string (not suitable for storage).
 *
 * @example formatMoney(1250, "EUR") → "12,50 €"  (it-IT locale)
 */
export function formatMoney(minor: number, currency: string): string {
  const float = parseFloat(fromMinor(minor, currency))
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(float)
}

// ── Decimal helpers (TEXT decimal strings) ────────────────────────────────────

/**
 * Wrap a stored decimal string (or plain number literal) in a Decimal for
 * safe arithmetic. Use for quantities, prices, TER, FX rates — anything
 * stored as TEXT in the database.
 *
 * @example dec("1.23456789").times(dec("100")).toString() → "123.45678900"
 */
export function dec(value: string | number): Decimal {
  return new Decimal(value)
}

export { Decimal }
