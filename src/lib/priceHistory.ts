// Append-only price history for instruments. One row per (instrument, date).
// "Last write wins" within the same day — preserves most recent refresh.
import { sqlite } from '@/db'

export function appendPriceHistory(
  instrumentId: number,
  date: string,        // ISO YYYY-MM-DD
  price: string,       // decimal string, in instrument currency
  currency: string,
  source: string | null,
): void {
  sqlite.prepare(`
    INSERT INTO price_history (instrument_id, date, price, currency, source)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (instrument_id, date)
    DO UPDATE SET price = excluded.price, source = excluded.source
  `).run(instrumentId, date, price, currency, source)
}
