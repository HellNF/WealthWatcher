// src/lib/categorization.ts — Bulk re-categorisation of existing transactions.
import { sqlite } from '@/db'
import { normalizeDescription, resolveCategoryRule, resolveMerchant } from './merchants'

interface TxnStub {
  id:              number
  description_raw: string
  counterparty_raw: string | null
}

/**
 * Re-apply category rules + merchant-alias matching to all existing transactions
 * for a user (optionally scoped to one bank account).
 *
 * Priority applied: user's category_rules → merchant alias default_category.
 * Transactions with no match are left with their current category.
 *
 * Returns how many rows were updated.
 */
export function recategorizeAll(
  ownerId:       number,
  bankAccountId?: number,
): { updated: number } {
  const args: unknown[] = [ownerId]
  const accountFilter = bankAccountId ? 'AND bank_account_id = ?' : ''
  if (bankAccountId) args.push(bankAccountId)

  const txns = sqlite
    .prepare(
      `SELECT id, description_raw, counterparty_raw
       FROM transactions
       WHERE owner_id = ? ${accountFilter}`,
    )
    .all(...args) as TxnStub[]

  const updateStmt = sqlite.prepare(
    'UPDATE transactions SET category_id = ?, merchant_id = ? WHERE id = ?',
  )

  let updated = 0

  const run = sqlite.transaction(() => {
    for (const txn of txns) {
      const normalized = normalizeDescription(
        txn.description_raw + ' ' + (txn.counterparty_raw ?? ''),
      )
      const ruleCategory = resolveCategoryRule(normalized, ownerId)
      const merchant     = resolveMerchant(normalized)

      // Only update when we have something to assign
      const newCategory = ruleCategory ?? merchant?.categoryId ?? null
      const newMerchant = merchant?.merchantId ?? null

      if (newCategory !== null || newMerchant !== null) {
        updateStmt.run(newCategory, newMerchant, txn.id)
        updated++
      }
    }
  })

  run()
  return { updated }
}
