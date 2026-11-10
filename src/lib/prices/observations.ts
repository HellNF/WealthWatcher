import { sqlite } from '@/db'
import type { Quote } from './provider'
export interface Observation { source: string; kind: string; observed_at: number; retrieved_at: number }
export function getObservation(instrumentId: number, asOf: number | null, price: string | null): Observation | null {
  if (!asOf || !price) return null
  return sqlite.prepare(`SELECT source, kind, observed_at, retrieved_at FROM price_observations
    WHERE instrument_id = ? AND observed_at = ? AND price = ? ORDER BY retrieved_at DESC, id DESC LIMIT 1`)
    .get(instrumentId, asOf, price) as Observation | undefined ?? null
}
export function recordObservation(instrumentId: number, quote: Quote, retrievedAt: number): void {
  sqlite.prepare(`INSERT INTO price_observations (instrument_id, price, currency, source, kind, observed_at, retrieved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(instrument_id, source, kind, observed_at)
    DO UPDATE SET price = excluded.price, currency = excluded.currency, retrieved_at = excluded.retrieved_at`)
    .run(instrumentId, quote.price, quote.currency, quote.source ?? 'unknown', quote.kind ?? 'quote', quote.asOf, retrievedAt)
}
