// Proposals are recomputed on apply: changed transactions/rules are never silently accepted.
import { createHash } from 'node:crypto'
import { sqlite } from '@/db'
import { normalizeDescription, resolveCategoryRule, resolveMerchant, resolveMccCategory, resolveBankTransactionCategory } from './merchants'
import { learnedCategory, trainCategoryModel } from './learnedCategories'

interface TxnStub {
  id: number; description_raw: string; counterparty_raw: string | null
  amount_minor: number; currency: string; booked_date: string
  mcc: string | null; btc_sub_code: string | null
  category_id: number | null; merchant_id: number | null; category_source: string
  bank_account_id: number
}
export interface CategoryProposal {
  id: number; description: string; date: string; amountMinor: number; currency: string
  before: string | null; after: string | null; categoryId: number | null
  merchantId: number | null; source: string; fingerprint: string
  /** Solo per le proposte apprese dallo storico (source = 'learned'). */
  confidence?: number
}

export function previewRecategorization(ownerId: number, bankAccountId?: number): CategoryProposal[] {
  const txns = sqlite.prepare(`SELECT * FROM transactions WHERE owner_id = ?
    AND category_source != 'manual' ${bankAccountId ? 'AND bank_account_id = ?' : ''}
    ORDER BY booked_date DESC, id DESC`).all(...(bankAccountId ? [ownerId, bankAccountId] : [ownerId])) as TxnStub[]
  const names = new Map((sqlite.prepare('SELECT id, name FROM categories').all() as { id: number; name: string }[]).map(c => [c.id, c.name]))
  // Addestrato solo se c'è qualcosa senza categoria da proporre.
  let model: ReturnType<typeof trainCategoryModel> | undefined
  return txns.flatMap(txn => {
    const normalized = normalizeDescription(txn.description_raw + ' ' + (txn.counterparty_raw ?? ''))
    const rule = resolveCategoryRule(normalized, ownerId, Math.abs(txn.amount_minor), { bankAccountId: txn.bank_account_id, amountMinor: txn.amount_minor })
    const merchant = resolveMerchant(normalized)
    const deterministic = rule ?? merchant?.categoryId ?? resolveMccCategory(txn.mcc)
      ?? resolveBankTransactionCategory(undefined, txn.btc_sub_code)
    const merchantId = merchant?.merchantId ?? txn.merchant_id
    // Lo storico propone solo dove la catena deterministica tace e il movimento
    // è ancora senza categoria: non sostituisce mai una categoria esistente.
    if (model === undefined && deterministic === null && txn.category_id === null) model = trainCategoryModel(ownerId)
    const learned = deterministic === null && txn.category_id === null
      ? learnedCategory(model ?? null, txn) : null
    const categoryId = deterministic ?? learned?.categoryId ?? txn.category_id
    if (categoryId === txn.category_id && merchantId === txn.merchant_id) return []
    const source = categoryId === txn.category_id ? txn.category_source
      : rule !== null ? 'rule' : learned ? 'learned' : 'automatic'
    return [{ id: txn.id, description: txn.description_raw, date: txn.booked_date,
      amountMinor: txn.amount_minor, currency: txn.currency,
      before: names.get(txn.category_id!) ?? null, after: names.get(categoryId!) ?? null,
      categoryId, merchantId, source,
      ...(learned && source === 'learned' ? { confidence: Math.round(learned.confidence * 100) / 100 } : {}),
      fingerprint: createHash('sha256').update(JSON.stringify([txn, categoryId, merchantId, source])).digest('hex'),
    }]
  })
}

export function applyRecategorization(ownerId: number, selection: { id: number; fingerprint: string }[]): { updated: number; skipped: number } {
  return sqlite.transaction(() => {
    const current = new Map(previewRecategorization(ownerId).map(p => [p.id, p]))
    const update = sqlite.prepare("UPDATE transactions SET category_id = ?, merchant_id = ?, category_source = ? WHERE id = ? AND owner_id = ? AND category_source != 'manual'")
    let updated = 0
    const unique = new Map(selection.map(p => [p.id, p]))
    for (const selected of unique.values()) {
      const proposal = current.get(selected.id)
      if (!proposal || proposal.fingerprint !== selected.fingerprint) continue
      updated += update.run(proposal.categoryId, proposal.merchantId, proposal.source, proposal.id, ownerId).changes
    }
    return { updated, skipped: unique.size - updated }
  })()
}

export function recategorizeAll(ownerId: number, bankAccountId?: number): { updated: number } {
  return applyRecategorization(ownerId, previewRecategorization(ownerId, bankAccountId))
}
