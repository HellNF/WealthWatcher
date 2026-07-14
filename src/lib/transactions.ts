// src/lib/transactions.ts — Transaction repository.
import { eq } from 'drizzle-orm'
import { db, sqlite } from '@/db'
import { importBatches } from '@/db/schema'
import type { ImportBatch, Transaction } from '@/db/schema'

export type { Transaction }

// ── Preview (classify rows before committing) ─────────────────────────────────

export type TxnStatus = 'new' | 'duplicate' | 'suspect'

export interface PreviewRow {
  status:         TxnStatus
  bookedDate:     string
  amountMinor:    number
  currency:       string
  descriptionRaw: string
  categoryName:   string | null
  dedupHash:      string
}

export interface InsertableTransaction {
  owner_id:         number
  bank_account_id:  number
  booked_date:      string
  value_date?:      string | null
  amount_minor:     number
  currency:         string
  description_raw:  string
  counterparty_raw?: string | null
  external_id?:     string | null
  dedup_hash:       string
  merchant_id?:     number | null
  category_id?:     number | null
  mcc?:             string | null
}

/**
 * Classify each row without writing to the database (SPEC §5.1 preview).
 *   duplicate — exact match on (bank_account_id, dedup_hash)
 *   suspect   — same (booked_date, amount_minor) with a different hash
 *   new       — no match found
 */
export function previewRows(
  bankAccountId: number,
  rows: InsertableTransaction[],
): PreviewRow[] {
  const exactStmt = sqlite.prepare(
    'SELECT 1 FROM transactions WHERE bank_account_id = ? AND dedup_hash = ?',
  )
  const suspectStmt = sqlite.prepare(
    'SELECT 1 FROM transactions WHERE bank_account_id = ? AND booked_date = ? AND amount_minor = ?',
  )
  const categoryStmt = sqlite.prepare(
    'SELECT name FROM categories WHERE id = (SELECT category_id FROM transactions WHERE bank_account_id = ? AND booked_date = ? AND amount_minor = ? LIMIT 1)',
  )

  return rows.map((row) => {
    const exact = exactStmt.get(bankAccountId, row.dedup_hash)
    if (exact) {
      // Fetch category name from the existing duplicate for display
      const cat = categoryStmt.get(bankAccountId, row.booked_date, row.amount_minor) as
        | { name: string }
        | undefined
      return {
        status:         'duplicate',
        bookedDate:     row.booked_date,
        amountMinor:    row.amount_minor,
        currency:       row.currency,
        descriptionRaw: row.description_raw,
        categoryName:   cat?.name ?? null,
        dedupHash:      row.dedup_hash,
      }
    }

    const suspect = suspectStmt.get(bankAccountId, row.booked_date, row.amount_minor)
    const status: TxnStatus = suspect ? 'suspect' : 'new'

    const categoryName = row.category_id
      ? (sqlite.prepare('SELECT name FROM categories WHERE id = ?').get(row.category_id) as
          | { name: string }
          | undefined)?.name ?? null
      : null

    return {
      status,
      bookedDate:     row.booked_date,
      amountMinor:    row.amount_minor,
      currency:       row.currency,
      descriptionRaw: row.description_raw,
      categoryName,
      dedupHash:      row.dedup_hash,
    }
  })
}

// ── Batch insert (atomic, dedup via INSERT OR IGNORE) ─────────────────────────

export interface ImportResult {
  batchId:        number
  rowCount:       number
  insertedCount:  number
  duplicateCount: number
}

export function insertBatch(params: {
  ownerId:       number
  bankAccountId: number
  source:        string
  filename:      string
  rows:          InsertableTransaction[]
}): ImportResult {
  let insertedCount  = 0
  let duplicateCount = 0
  let batchId        = 0

  const run = sqlite.transaction(() => {
    // Create the audit record (counts updated at end of transaction)
    const batchRow = db
      .insert(importBatches)
      .values({
        owner_id:        params.ownerId,
        bank_account_id: params.bankAccountId,
        source:          params.source,
        filename:        params.filename,
        row_count:       params.rows.length,
        inserted_count:  0,
        duplicate_count: 0,
      })
      .returning()
      .get() as ImportBatch
    batchId = batchRow.id

    const insertStmt = sqlite.prepare(`
      INSERT OR IGNORE INTO transactions
        (owner_id, bank_account_id, booked_date, value_date, amount_minor, currency,
         description_raw, counterparty_raw, external_id, dedup_hash, import_batch_id,
         merchant_id, category_id, mcc)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `)

    for (const row of params.rows) {
      const result = insertStmt.run(
        row.owner_id, row.bank_account_id, row.booked_date, row.value_date ?? null,
        row.amount_minor, row.currency, row.description_raw, row.counterparty_raw ?? null,
        row.external_id ?? null, row.dedup_hash, batchId,
        row.merchant_id ?? null, row.category_id ?? null, row.mcc ?? null,
      )
      if (result.changes > 0) insertedCount++
      else duplicateCount++
    }

    sqlite
      .prepare('UPDATE import_batches SET inserted_count = ?, duplicate_count = ? WHERE id = ?')
      .run(insertedCount, duplicateCount, batchId)
  })

  run()

  return {
    batchId,
    rowCount:      params.rows.length,
    insertedCount,
    duplicateCount,
  }
}

// ── List + details ────────────────────────────────────────────────────────────

export interface TransactionRow {
  id:              number
  booked_date:     string
  amount_minor:    number
  currency:        string
  description_raw: string
  category_name:   string | null
  merchant_name:   string | null
  category_id:     number | null
}

export interface ListTransactionsOpts {
  from?:  string   // ISO YYYY-MM-DD — incluso
  to?:    string   // ISO YYYY-MM-DD — incluso
  limit?: number   // default 50
}

export function listTransactions(
  userId: number,
  bankAccountId: number,
  opts: ListTransactionsOpts = {},
): TransactionRow[] {
  const { from, to, limit = 50 } = opts
  const conds: string[]          = ['t.owner_id = ?', 't.bank_account_id = ?']
  const args:  (string | number)[] = [userId, bankAccountId]
  if (from) { conds.push('t.booked_date >= ?'); args.push(from) }
  if (to)   { conds.push('t.booked_date <= ?'); args.push(to)   }
  args.push(limit)

  return sqlite
    .prepare(
      `SELECT t.id, t.booked_date, t.amount_minor, t.currency,
              t.description_raw, t.category_id,
              c.name AS category_name,
              m.canonical_name AS merchant_name
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN merchants  m ON m.id = t.merchant_id
       WHERE ${conds.join(' AND ')}
       ORDER BY t.booked_date DESC, t.id DESC
       LIMIT ?`,
    )
    .all(...args) as TransactionRow[]
}

export function countTransactions(
  userId: number,
  bankAccountId: number,
  opts: Pick<ListTransactionsOpts, 'from' | 'to'> = {},
): number {
  const { from, to }               = opts
  const conds: string[]            = ['owner_id = ?', 'bank_account_id = ?']
  const args: (string | number)[]  = [userId, bankAccountId]
  if (from) { conds.push('booked_date >= ?'); args.push(from) }
  if (to)   { conds.push('booked_date <= ?'); args.push(to)   }
  const row = sqlite
    .prepare(`SELECT COUNT(*) AS n FROM transactions WHERE ${conds.join(' AND ')}`)
    .get(...args) as { n: number }
  return row.n
}

export function updateTransactionCategory(
  userId: number,
  txnId: number,
  categoryId: number | null,
): void {
  sqlite
    .prepare('UPDATE transactions SET category_id = ? WHERE id = ? AND owner_id = ?')
    .run(categoryId, txnId, userId)
}

export function updateTransactionDescription(
  userId: number,
  txnId: number,
  description: string,
): void {
  sqlite
    .prepare('UPDATE transactions SET description_raw = ? WHERE id = ? AND owner_id = ?')
    .run(description.trim(), txnId, userId)
}

export function deleteTransaction(userId: number, txnId: number): void {
  sqlite
    .prepare('DELETE FROM transactions WHERE id = ? AND owner_id = ?')
    .run(txnId, userId)
}

export function listAllCategories(): { id: number; name: string; kind: string }[] {
  return sqlite
    .prepare('SELECT id, name, kind FROM categories ORDER BY kind, name')
    .all() as { id: number; name: string; kind: string }[]
}
