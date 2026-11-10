// src/__tests__/lib/categorization.test.ts — recategorizeAll: riapplica la
// stessa catena del sync (regola utente → alias merchant → MCC →
// bank_transaction_code) allo storico già importato. Il caso chiave è l'MCC/
// btc_sub_code persistiti: una transazione salvata senza categoria ma con uno
// dei due deve riceverla al re-run, senza dover ri-sincronizzare dalla banca.
import { recategorizeAll, previewRecategorization, applyRecategorization } from '@/lib/categorization'
import { sqlite } from '@/db'
import { insertBatch, updateTransactionCategory, listTransactions, countTransactions } from '@/lib/transactions'

function categoryName(id: number | null): string | null {
  if (id === null) return null
  const row = sqlite.prepare('SELECT name FROM categories WHERE id = ?').get(id) as { name: string } | undefined
  return row?.name ?? null
}

describe('recategorizeAll — fallback MCC', () => {
  let ownerId: number
  let accountId: number

  beforeAll(() => {
    sqlite.exec(`
      INSERT OR IGNORE INTO allowed_emails (email, role) VALUES ('recat_test@example.com','member');
      INSERT OR IGNORE INTO users (email, role) VALUES ('recat_test@example.com','member');
    `)
    ownerId = (sqlite.prepare("SELECT id FROM users WHERE email='recat_test@example.com'").get() as { id: number }).id

    sqlite.prepare(`INSERT INTO institutions (owner_id, name, kind) VALUES (?, 'EB Test', 'bank')`).run(ownerId)
    const inst = sqlite.prepare('SELECT id FROM institutions WHERE owner_id = ? LIMIT 1').get(ownerId) as { id: number }
    sqlite.prepare(`INSERT INTO bank_accounts (institution_id, owner_id, name, currency) VALUES (?, ?, 'Conto EB', 'EUR')`).run(inst.id, ownerId)
    accountId = (sqlite.prepare('SELECT id FROM bank_accounts WHERE owner_id = ? LIMIT 1').get(ownerId) as { id: number }).id
  })

  afterEach(() => {
    sqlite.prepare('DELETE FROM transactions WHERE owner_id = ?').run(ownerId)
  })

  afterAll(() => {
    sqlite.prepare('DELETE FROM bank_accounts WHERE owner_id = ?').run(ownerId)
    sqlite.prepare('DELETE FROM institutions WHERE owner_id = ?').run(ownerId)
    sqlite.prepare('DELETE FROM users WHERE id = ?').run(ownerId)
  })

  function insertTxn(mcc: string | null, categoryId: number | null, btcSubCode: string | null = null): number {
    const info = sqlite.prepare(
      `INSERT INTO transactions
         (owner_id, bank_account_id, booked_date, amount_minor, currency,
          description_raw, dedup_hash, category_id, mcc, btc_sub_code)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      ownerId, accountId, '2026-07-01', -3500, 'EUR',
      'MOVIMENTO INDECIFRABILE', `hash-${mcc}-${btcSubCode}-${Math.random()}`, categoryId, mcc, btcSubCode,
    )
    return Number(info.lastInsertRowid)
  }

  test('transazione senza categoria ma con MCC → riceve la categoria dal re-run', () => {
    const id = insertTxn('5411', null) // supermercati
    const { updated } = recategorizeAll(ownerId, accountId)
    expect(updated).toBeGreaterThanOrEqual(1)
    const row = sqlite.prepare('SELECT category_id FROM transactions WHERE id = ?').get(id) as { category_id: number | null }
    expect(categoryName(row.category_id)).toBe('Supermercato')
  })

  test('senza MCC e senza altri segnali → resta senza categoria', () => {
    const id = insertTxn(null, null)
    recategorizeAll(ownerId, accountId)
    const row = sqlite.prepare('SELECT category_id FROM transactions WHERE id = ?').get(id) as { category_id: number | null }
    expect(row.category_id).toBeNull()
  })

  test('transazione senza categoria ma con btc_sub_code (stipendio) → riceve la categoria dal re-run', () => {
    const id = insertTxn(null, null, 'SALA')
    recategorizeAll(ownerId, accountId)
    const row = sqlite.prepare('SELECT category_id FROM transactions WHERE id = ?').get(id) as { category_id: number | null }
    expect(categoryName(row.category_id)).toBe('Stipendio')
  })

  test('MCC ha priorità sul btc_sub_code quando entrambi sono presenti', () => {
    const id = insertTxn('5411', null, 'SALA') // supermercati vs stipendio
    recategorizeAll(ownerId, accountId)
    const row = sqlite.prepare('SELECT category_id FROM transactions WHERE id = ?').get(id) as { category_id: number | null }
    expect(categoryName(row.category_id)).toBe('Supermercato')
  })
  test('alias senza categoria non cancella la categoria esistente; rerun idempotente', () => {
    const category = sqlite.prepare("SELECT id FROM categories WHERE name = 'Shopping'").get() as { id: number }
    const merchantId = Number(sqlite.prepare("INSERT INTO merchants (canonical_name) VALUES ('Unclassified Test')").run().lastInsertRowid)
    sqlite.prepare("INSERT INTO merchant_aliases (pattern, merchant_id) VALUES ('indecifrabile', ?)").run(merchantId)
    try {
      const id = insertTxn(null, category.id)
      expect(recategorizeAll(ownerId, accountId).updated).toBe(1)
      const row = sqlite.prepare('SELECT category_id, merchant_id FROM transactions WHERE id = ?').get(id)
      expect(row).toEqual({ category_id: category.id, merchant_id: merchantId })
      expect(recategorizeAll(ownerId, accountId).updated).toBe(0)
    } finally {
      sqlite.prepare('DELETE FROM transactions WHERE owner_id = ?').run(ownerId)
      sqlite.prepare('DELETE FROM merchant_aliases WHERE merchant_id = ?').run(merchantId)
      sqlite.prepare('DELETE FROM merchants WHERE id = ?').run(merchantId)
    }
  })

  test('sync ripetuta recupera MCC e categoria mancanti senza sovrascrivere correzioni', () => {
    const id = insertTxn(null, null)
    const original = sqlite.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as import('@/db/schema').Transaction
    const category = sqlite.prepare("SELECT id FROM categories WHERE name = 'Supermercato'").get() as { id: number }
    const otherCategory = sqlite.prepare("SELECT id FROM categories WHERE name = 'Shopping'").get() as { id: number }
    const params = { ownerId, bankAccountId: accountId, source: 'enablebanking', filename: 'test',
      rows: [{ ...original, mcc: '5411', category_id: category.id }] }
    expect(insertBatch(params)).toMatchObject({ insertedCount: 0, duplicateCount: 1 })
    expect(sqlite.prepare('SELECT mcc, category_id FROM transactions WHERE id = ?').get(id))
      .toEqual({ mcc: '5411', category_id: category.id })
    sqlite.prepare('UPDATE transactions SET category_id = ? WHERE id = ?').run(otherCategory.id, id)
    insertBatch(params)
    expect(sqlite.prepare('SELECT category_id FROM transactions WHERE id = ?').get(id))
      .toEqual({ category_id: otherCategory.id })
  })

  test('manual removal is protected from recategorization and repeated sync', () => {
    const id = insertTxn('5411', null)
    const row = sqlite.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as import('@/db/schema').Transaction
    const category = sqlite.prepare("SELECT id FROM categories WHERE name = 'Supermercato'").get() as { id: number }
    updateTransactionCategory(ownerId, id, null)
    expect(previewRecategorization(ownerId)).toHaveLength(0)
    insertBatch({ ownerId, bankAccountId: accountId, source: 'enablebanking', filename: 'test', rows: [{ ...row, category_id: category.id }] })
    expect(sqlite.prepare('SELECT category_id, category_source FROM transactions WHERE id = ?').get(id)).toEqual({ category_id: null, category_source: 'manual' })
  })
  test('preview does not write, and a concurrent manual change invalidates it', () => {
    const id = insertTxn('5411', null)
    const proposals = previewRecategorization(ownerId)
    expect(proposals.map(p => p.id)).toContain(id)
    expect(sqlite.prepare('SELECT category_id FROM transactions WHERE id = ?').get(id)).toEqual({ category_id: null })
    updateTransactionCategory(ownerId, id, null)
    expect(applyRecategorization(ownerId, proposals)).toEqual({ updated: 0, skipped: 1 })
  })
  test('apply checks owner and proposals cannot be replayed', () => {
    insertTxn('5411', null)
    const proposals = previewRecategorization(ownerId)
    expect(applyRecategorization(ownerId + 999, proposals).updated).toBe(0)
    expect(applyRecategorization(ownerId, proposals).updated).toBe(1)
    expect(applyRecategorization(ownerId, proposals).updated).toBe(0)
  })
  test('duplicate review counts and lists the same rows without deleting legitimate twins', () => {
    insertTxn(null, null); insertTxn(null, null)
    expect(countTransactions(ownerId, accountId, { review: 'duplicates' })).toBe(2)
    expect(listTransactions(ownerId, accountId, { review: 'duplicates' })).toHaveLength(2)
    expect(listTransactions(ownerId + 999, accountId, { review: 'duplicates' })).toHaveLength(0)
    expect(countTransactions(ownerId, accountId, { review: 'uncategorized' })).toBe(2)
  })
  test('known old bank identity is reconciled without losing manual choices', () => {
    const id = insertTxn(null, null)
    const original = sqlite.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as import('@/db/schema').Transaction
    updateTransactionCategory(ownerId, id, null)
    const result = insertBatch({ ownerId, bankAccountId: accountId, source: 'enablebanking', filename: 'test',
      rows: [{ ...original, dedup_hash: 'new-stable-hash', legacy_dedup_hash: original.dedup_hash }] })
    expect(result.insertedCount).toBe(0)
    expect(sqlite.prepare('SELECT id, category_source, dedup_hash FROM transactions WHERE id = ?').get(id))
      .toEqual({ id, category_source: 'manual', dedup_hash: 'new-stable-hash' })
  })

})
