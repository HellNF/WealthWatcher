// src/lib/format.ts — Formattazione per la UI (importi, date), senza dipendenze:
// usabile anche nei Client Component senza portarsi dietro decimal.js.
//
// I formatter Intl sono costosi da creare: si tengono in cache e si riusano,
// invece di chiamare toLocaleString() (che ne crea uno a ogni cella).

export const CURRENCY_DECIMALS: Record<string, number> = {
  EUR: 2, USD: 2, GBP: 2, CHF: 2, SEK: 2, NOK: 2, DKK: 2, JPY: 0, BTC: 8, ETH: 8,
}

export function decimalsFor(currency: string): number {
  const d = CURRENCY_DECIMALS[currency.toUpperCase()]
  if (d === undefined) throw new Error(`Unsupported currency: ${currency}`)
  return d
}

const formatters = new Map<string, Intl.NumberFormat>()

function currencyFormat(currency: string, decimals: number): Intl.NumberFormat {
  const key = `${currency}:${decimals}`
  let f = formatters.get(key)
  if (!f) {
    // Separatore delle migliaia sempre presente: it-IT di default lo omette
    // sotto 10.000 ("3818 €" accanto a "11.074 €").
    f = new Intl.NumberFormat('it-IT', {
      style: 'currency', currency, useGrouping: 'always',
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    })
    formatters.set(key, f)
  }
  return f
}

/**
 * Importo in unità minori, con i decimali della valuta. Formato unico per ogni
 * importo mostrato in UI (non adatto alla persistenza).
 *
 * @example formatMoney(381806, "EUR") → "3.818,06 €"
 */
export function formatMoney(minor: number, currency: string): string {
  const code = currency.toUpperCase()
  const d = decimalsFor(code)
  return currencyFormat(code, d).format(minor / 10 ** d)
}

/** Euro da centesimi; `decimals = 0` arrotonda all'euro (grafici, riepiloghi). */
export function fmtEur(minor: number, decimals: 0 | 2 = 2): string {
  return currencyFormat('EUR', decimals).format(minor / 100)
}

/**
 * Importo compatto per le etichette degli assi dei grafici: lo spazio è poco e
 * un "1.234.567 €" verrebbe tagliato o accavallato. Es. 8 Mrd €, 1,5 Mln €, 12k €.
 */
export function formatAxisMoney(minor: number, currency = 'EUR'): string {
  const v = minor / 100
  const abs = Math.abs(v)
  const symbol = currency === 'EUR' ? '€' : currency
  const n = (x: number) => x.toLocaleString('it-IT', { maximumFractionDigits: 1 })
  if (abs >= 1e9)  return `${n(v / 1e9)} Mrd ${symbol}`
  if (abs >= 1e6)  return `${n(v / 1e6)} Mln ${symbol}`
  if (abs >= 1e4)  return `${n(v / 1e3)}k ${symbol}`
  return `${Math.round(v).toLocaleString('it-IT', { useGrouping: 'always' })} ${symbol}`
}

/** "2026-11-05" → "05/11/2026" */
export function fmtIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** "2026-11-05" → "05/11" */
export function fmtIsoDayMonth(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const longDay = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Rome',
})

/** "2026-11-05" → "5 nov 2026" (mezzogiorno UTC: nessuno slittamento di fuso). */
export function fmtIsoDay(iso: string): string {
  return longDay.format(new Date(`${iso}T12:00:00Z`))
}
