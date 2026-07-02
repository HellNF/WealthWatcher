// src/lib/investmentTxns.ts — InvestmentTxn repository.
import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { investmentTxns } from '@/db/schema'
import type { InvestmentTxn } from '@/db/schema'
import { getPortfolioForUser } from '@/lib/portfolios'

export type { InvestmentTxn }

export interface InsertTxnParams {
  instrument_id: number
  type:          'buy' | 'sell' | 'dividend' | 'fee'
  trade_date:    string   // ISO YYYY-MM-DD
  quantity?:     string | null
  unit_price?:   string | null
  fee_minor?:    number
  amount_minor?: number | null
  currency:      string
  note?:         string | null
}

/**
 * Insert a new transaction, with ownership re-check on the portfolio.
 * Returns the newly created row.
 */
export function insertTxn(
  userId: number,
  portfolioId: number,
  data: InsertTxnParams,
): InvestmentTxn {
  const portfolio = getPortfolioForUser(userId, portfolioId)
  if (!portfolio) throw new Error('Portafoglio non trovato o non autorizzato')

  return db
    .insert(investmentTxns)
    .values({
      owner_id:      userId,
      portfolio_id:  portfolioId,
      instrument_id: data.instrument_id,
      type:          data.type,
      trade_date:    data.trade_date,
      quantity:      data.quantity ?? null,
      unit_price:    data.unit_price ?? null,
      fee_minor:     data.fee_minor ?? 0,
      amount_minor:  data.amount_minor ?? null,
      currency:      data.currency,
      note:          data.note ?? null,
    })
    .returning()
    .get() as InvestmentTxn
}

/**
 * List all transactions for a portfolio, ordered chronologically.
 * Ownership is established by the portfolio ownership check.
 */
export function listTxns(userId: number, portfolioId: number): InvestmentTxn[] {
  // Verify ownership before listing
  const portfolio = getPortfolioForUser(userId, portfolioId)
  if (!portfolio) return []

  return db
    .select()
    .from(investmentTxns)
    .where(eq(investmentTxns.portfolio_id, portfolioId))
    .orderBy(asc(investmentTxns.trade_date), asc(investmentTxns.id))
    .all() as InvestmentTxn[]
}

/**
 * Delete a transaction (ownership check via owner_id column).
 */
export function deleteTxn(userId: number, txnId: number): void {
  db
    .delete(investmentTxns)
    .where(and(eq(investmentTxns.id, txnId), eq(investmentTxns.owner_id, userId)))
    .run()
}

/**
 * Group transactions by instrument_id, returning a map suitable for the FIFO engine.
 * Already sorted by (trade_date, id) — the required FIFO order.
 */
export function txnsByInstrument(
  txns: InvestmentTxn[],
): Map<number, InvestmentTxn[]> {
  const map = new Map<number, InvestmentTxn[]>()
  for (const txn of txns) {
    const list = map.get(txn.instrument_id) ?? []
    list.push(txn)
    map.set(txn.instrument_id, list)
  }
  return map
}
