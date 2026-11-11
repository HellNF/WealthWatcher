// Regole di categoria con condizioni facoltative (conto, entrate/uscite):
// corrispondenza, precedenza della regola più specifica, unicità per testo +
// condizioni, conti di altri utenti, anteprima sullo storico.
import { sqlite } from '@/db'
import {
  createCategoryRule, resolveCategoryRule, previewCategoryRule, listCategoryRules,
} from '@/lib/merchants'

let userId: number, otherUserId: number, checking: number, card: number, foreign: number
const cat = (name: string) => (sqlite.prepare('SELECT id FROM categories WHERE name = ?').get(name) as { id: number }).id

function user(email: string): number {
  sqlite.prepare(`INSERT OR IGNORE INTO allowed_emails (email, role) VALUES (?, 'member')`).run(email)
  sqlite.prepare(`INSERT OR IGNORE INTO users (email, role) VALUES (?, 'member')`).run(email)
  return (sqlite.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number }).id
}
function account(owner: number, name: string): number {
  const inst = Number(sqlite.prepare(`INSERT INTO institutions (owner_id, name, kind) VALUES (?, 'Banca', 'bank')`).run(owner).lastInsertRowid)
  return Number(sqlite.prepare(`INSERT INTO bank_accounts (institution_id, owner_id, name, currency) VALUES (?, ?, ?, 'EUR')`).run(inst, owner, name).lastInsertRowid)
}

beforeAll(() => {
  userId = user('rules@example.com'); otherUserId = user('rules-other@example.com')
  checking = account(userId, 'Corrente'); card = account(userId, 'Carta'); foreign = account(otherUserId, 'Altrui')
})
afterEach(() => {
  sqlite.prepare('DELETE FROM category_rules WHERE owner_id IN (?, ?)').run(userId, otherUserId)
  sqlite.prepare('DELETE FROM transactions WHERE owner_id = ?').run(userId)
})

test('direzione: "bonifico" in entrata è lo stipendio, in uscita no', () => {
  createCategoryRule(userId, { pattern: 'bonifico', categoryId: cat('Entrate'), direction: 'in' })
  expect(resolveCategoryRule('bonifico acme spa', userId, undefined, { bankAccountId: checking, amountMinor: 200_000 })).toBe(cat('Entrate'))
  expect(resolveCategoryRule('bonifico acme spa', userId, undefined, { bankAccountId: checking, amountMinor: -200_000 })).toBeNull()
  // Senza contesto una regola condizionata non corrisponde mai.
  expect(resolveCategoryRule('bonifico acme spa', userId, 200_000)).toBeNull()
})

test('conto: la regola vale solo per quel conto e vince su quella generica', () => {
  createCategoryRule(userId, { pattern: 'amazon', categoryId: cat('Shopping') })
  createCategoryRule(userId, { pattern: 'amazon', categoryId: cat('Abbonamenti'), bankAccountId: card })
  expect(resolveCategoryRule('amazon prime', userId, undefined, { bankAccountId: card, amountMinor: -499 })).toBe(cat('Abbonamenti'))
  expect(resolveCategoryRule('amazon prime', userId, undefined, { bankAccountId: checking, amountMinor: -499 })).toBe(cat('Shopping'))
})

test('unicità su testo + condizioni; conti di altri utenti rifiutati', () => {
  expect(createCategoryRule(userId, { pattern: 'Netflix', categoryId: cat('Abbonamenti') }).ok).toBe(true)
  expect(createCategoryRule(userId, { pattern: 'netflix', categoryId: cat('Abbonamenti') })).toMatchObject({ ok: false })
  expect(createCategoryRule(userId, { pattern: 'netflix', categoryId: cat('Abbonamenti'), direction: 'out' }).ok).toBe(true)
  expect(createCategoryRule(userId, { pattern: 'netflix', categoryId: cat('Abbonamenti'), bankAccountId: foreign }))
    .toEqual({ ok: false, error: 'Conto non trovato.' })
  const rules = listCategoryRules(userId)
  expect(rules.map((r) => [r.pattern, r.direction])).toEqual(expect.arrayContaining([['netflix', null], ['netflix', 'out']]))
})

test('anteprima: corrispondenze, cambi previsti, scelte manuali lasciate intatte', () => {
  const insert = sqlite.prepare(
    `INSERT INTO transactions (owner_id, bank_account_id, booked_date, amount_minor, currency, description_raw, dedup_hash, category_id, category_source)
     VALUES (?, ?, ?, ?, 'EUR', ?, ?, ?, ?)`)
  let n = 0
  const txn = (accountId: number, amount: number, desc: string, category: number | null, source = 'automatic') =>
    insert.run(userId, accountId, `2026-05-${String(10 + n).padStart(2, '0')}`, amount, desc, `rp-${n++}`, category, source)
  txn(checking, -1299, 'NETFLIX.COM', null)
  txn(checking, -1299, 'NETFLIX.COM', cat('Abbonamenti'))
  txn(checking, -1299, 'NETFLIX.COM', cat('Altro'), 'manual')
  txn(card, -1299, 'NETFLIX.COM', null)
  txn(checking, 1299, 'RIMBORSO NETFLIX', null)

  const all = previewCategoryRule(userId, { pattern: 'netflix', categoryId: cat('Abbonamenti') })
  expect(all).toMatchObject({ matches: 5, wouldChange: 3, manualKept: 1 })
  expect(all.samples).toHaveLength(5)

  expect(previewCategoryRule(userId, { pattern: 'netflix', categoryId: cat('Abbonamenti'), direction: 'out', bankAccountId: checking }))
    .toMatchObject({ matches: 3, wouldChange: 1, manualKept: 1 })
  expect(previewCategoryRule(userId, { pattern: 'netflix', categoryId: cat('Abbonamenti'), amountMinorMin: 2000 }).matches).toBe(0)
  expect(previewCategoryRule(userId, { pattern: '   ', categoryId: cat('Abbonamenti') }).matches).toBe(0)
})
