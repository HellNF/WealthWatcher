// src/__tests__/lib/categorization.test.ts — recategorizeAll: riapplica la
// stessa catena del sync (regola utente → alias merchant → MCC) allo storico
// già importato. Il caso chiave è l'MCC persistito: una transazione salvata
// senza categoria ma con MCC deve ricevere la categoria al re-run, senza dover
// ri-sincronizzare dalla banca.
import { recategorizeAll } from '@/lib/categorization'
import { sqlite } from '@/db'

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

  function insertTxn(mcc: string | null, categoryId: number | null): number {
    const info = sqlite.prepare(
      `INSERT INTO transactions
         (owner_id, bank_account_id, booked_date, amount_minor, currency,
          description_raw, dedup_hash, category_id, mcc)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    ).run(
      ownerId, accountId, '2026-07-01', -3500, 'EUR',
      'MOVIMENTO INDECIFRABILE', `hash-${mcc}-${Math.random()}`, categoryId, mcc,
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
})
