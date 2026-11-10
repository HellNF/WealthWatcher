// Append-only price history for instruments. One row per (instrument, date).
// Daily prices only. Intraday observations and cumulative returns have separate storage.
import { sqlite } from '@/db'

export function appendPriceHistory(
  instrumentId: number,
  date: string,        // ISO YYYY-MM-DD
  price: string,       // decimal string, in instrument currency
  currency: string,
  source: string | null,
  kind: 'close' | 'daily-reference' = 'close',
): void {
  sqlite.prepare(`
    INSERT INTO price_history (instrument_id, date, price, currency, source, kind, retrieved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (instrument_id, date)
    DO UPDATE SET price = excluded.price, currency = excluded.currency, source = excluded.source, kind = excluded.kind, retrieved_at = excluded.retrieved_at
  `).run(instrumentId, date, price, currency, source, kind, Math.floor(Date.now() / 1000))
}
