// src/lib/instruments.ts — Instrument catalogue (global, no owner_id).
import { eq } from 'drizzle-orm'
import { db, sqlite } from '@/db'
import { instruments } from '@/db/schema'
import type { Instrument } from '@/db/schema'

export type { Instrument }

export interface CreateInstrumentParams {
  symbol:               string
  name:                 string
  cluster:              'etf' | 'bond' | 'stock' | 'crypto' | 'other'
  currency:             string
  price_source?:        'yahoo' | 'coingecko' | 'alphavantage' | 'manual'
  isin?:                string | null
  ter?:                 string | null
  provider_symbol?:     string | null
  /** Percentage of White List government bonds (0–100). Drives the synthetic tax rate. */
  whitelist_percentage?: string | null
}

/**
 * Upsert by symbol: insert if new, return existing if already present.
 * Called inline when the user adds an operation for a ticker they haven't used before.
 */
export function getOrCreateInstrument(params: CreateInstrumentParams): Instrument {
  // Try insert ignoring conflict, then always select to get the canonical row.
  sqlite
    .prepare(
      `INSERT INTO instruments
         (symbol, name, cluster, currency, price_source, isin, ter, provider_symbol, whitelist_percentage)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON CONFLICT(symbol) DO NOTHING`,
    )
    .run(
      params.symbol.toUpperCase(),
      params.name,
      params.cluster,
      params.currency.toUpperCase(),
      params.price_source ?? 'yahoo',
      params.isin ?? null,
      params.ter ?? null,
      params.provider_symbol ?? null,
      params.whitelist_percentage ?? '0',
    )

  return db
    .select()
    .from(instruments)
    .where(eq(instruments.symbol, params.symbol.toUpperCase()))
    .get() as Instrument
}

export function getInstrument(id: number): Instrument | undefined {
  return db.select().from(instruments).where(eq(instruments.id, id)).get() as
    | Instrument
    | undefined
}

export function getInstrumentBySymbol(symbol: string): Instrument | undefined {
  return db
    .select()
    .from(instruments)
    .where(eq(instruments.symbol, symbol.toUpperCase()))
    .get() as Instrument | undefined
}

export function listInstruments(): Instrument[] {
  return db.select().from(instruments).all() as Instrument[]
}

/** Simboli distinti degli strumenti in cui l'utente ha transazioni. */
export function getOwnerInstrumentSymbols(userId: number): string[] {
  const rows = sqlite
    .prepare(
      `SELECT DISTINCT i.symbol
       FROM investment_txns it
       JOIN instruments i ON i.id = it.instrument_id
       WHERE it.owner_id = ?
       LIMIT 8`,
    )
    .all(userId) as { symbol: string }[]
  return rows.map((r) => r.symbol)
}

export function updateInstrumentPrice(
  id: number,
  price: string,
  asOfEpoch: number,
): void {
  sqlite
    .prepare(
      'UPDATE instruments SET last_price = ?, last_price_at = ? WHERE id = ?',
    )
    .run(price, asOfEpoch, id)
}

export interface KidFields {
  name?:       string | null
  ter?:        string | null  // decimal string, e.g. "0.20" for 0.20%
  entry_cost?: string | null
  exit_cost?:  string | null
  sri?:        number | null
}

/**
 * Update only the whitelist_percentage for an existing instrument.
 * Called when the user manually edits the fiscal settings of an instrument.
 */
export function updateInstrumentWhitelistPct(id: number, whitelistPct: string): void {
  sqlite.prepare('UPDATE instruments SET whitelist_percentage = ? WHERE id = ?').run(whitelistPct, id)
}

export function updateInstrumentKidFields(id: number, fields: KidFields): void {
  const sets: string[] = []
  const args: (string | number | null)[] = []
  if (fields.name       !== undefined) { sets.push('name = ?');       args.push(fields.name ?? null) }
  if (fields.ter        !== undefined) { sets.push('ter = ?');        args.push(fields.ter ?? null) }
  if (fields.entry_cost !== undefined) { sets.push('entry_cost = ?'); args.push(fields.entry_cost ?? null) }
  if (fields.exit_cost  !== undefined) { sets.push('exit_cost = ?');  args.push(fields.exit_cost ?? null) }
  if (fields.sri        !== undefined) { sets.push('sri = ?');        args.push(fields.sri ?? null) }
  if (sets.length === 0) return
  args.push(id)
  sqlite.prepare(`UPDATE instruments SET ${sets.join(', ')} WHERE id = ?`).run(...args)
}
