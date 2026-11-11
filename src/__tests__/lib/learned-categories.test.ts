// Categorie apprese dallo storico: soglie minime, indizi distintivi, vincolo
// entrate/uscite, esclusione delle proprie proposte e integrazione con la
// revisione dello storico (mai sopra una categoria esistente).
import { trainFromRows, tokenize, fillLearnedCategories } from '@/lib/learnedCategories'
import { previewRecategorization, applyRecategorization } from '@/lib/categorization'
import { sqlite } from '@/db'

const GROCERY = 1, STREAMING = 2, SALARY = 3, RESTAURANT = 4

type Row = Parameters<typeof trainFromRows>[0][number]
function row(description: string, category_id: number, amount_minor = -2500, extra: Partial<Row> = {}): Row {
  return {
    description_raw: description, counterparty_raw: null, amount_minor, bank_account_id: 1,
    merchant_id: null, category_id, category_source: 'legacy',
    category_kind: category_id === SALARY ? 'income' : 'expense', ...extra,
  }
}
function history(): Row[] {
  const rows: Row[] = []
  for (let i = 0; i < 8; i++) rows.push(row(`ESSELUNGA MILANO ${i}`, GROCERY, -3000 - i * 100))
  for (let i = 0; i < 6; i++) rows.push(row('NETFLIX.COM AMSTERDAM', STREAMING, -1299))
  for (let i = 0; i < 4; i++) rows.push(row('STIPENDIO ACME SPA', SALARY, 180000))
  for (let i = 0; i < 4; i++) rows.push(row(`TRATTORIA DA MARIO MILANO`, RESTAURANT, -4500))
  return rows
}
const txn = (description: string, amount_minor = -2500) =>
  ({ description_raw: description, counterparty_raw: null, amount_minor, bank_account_id: 1, merchant_id: null })

test('tokenize: niente numeri, codici o lettere singole', () => {
  expect(tokenize('POS 12/03 ESSELUNGA x 2k4l19 MI', null)).toEqual(['pos', 'esselunga', 'mi'])
})

test('troppo pochi esempi o una sola categoria: nessun modello', () => {
  expect(trainFromRows(history().slice(0, 10))).toBeNull()
  expect(trainFromRows(Array.from({ length: 30 }, () => row('ESSELUNGA', GROCERY)))).toBeNull()
})

test('riconosce un merchant ricorrente con una descrizione nuova', () => {
  const model = trainFromRows(history())!
  const result = model.classify(txn('ESSELUNGA VIA PADOVA', -4200))
  expect(result?.categoryId).toBe(GROCERY)
  expect(result!.confidence).toBeGreaterThan(0.8)
  expect(model.classify(txn('NETFLIX', -1299))?.categoryId).toBe(STREAMING)
})

test('una parola comune a più categorie, come la città, non basta', () => {
  const model = trainFromRows(history())!
  expect(model.classify(txn('NEGOZIO NUOVO MILANO', -2000))).toBeNull()
})

test('senza parole note né merchant noto non risponde', () => {
  expect(trainFromRows(history())!.classify(txn('XYZ QWERTY', -2000))).toBeNull()
})

test("un'uscita non riceve mai una categoria di entrata", () => {
  const model = trainFromRows(history())!
  expect(model.classify(txn('STIPENDIO ACME SPA', 180000))?.categoryId).toBe(SALARY)
  expect(model.classify(txn('STIPENDIO ACME SPA', -180000))?.categoryId).not.toBe(SALARY)
})

test('le proprie proposte non entrano mai nell’addestramento', () => {
  const base = history()
  const fed = [...base, ...Array.from({ length: 10 }, () => row('PIZZERIA STELLA', RESTAURANT, -1500, { category_source: 'learned' }))]
  expect(trainFromRows(fed)!.classify(txn('PIZZERIA STELLA', -1500))).toBeNull()
  expect(trainFromRows(fed)!.examples).toBe(base.length)
})

describe('integrazione con import e revisione dello storico', () => {
  let ownerId: number, accountId: number
  let grocery: number, streaming: number

  beforeAll(() => {
    sqlite.exec(`
      INSERT OR IGNORE INTO allowed_emails (email, role) VALUES ('learned_test@example.com','member');
      INSERT OR IGNORE INTO users (email, role) VALUES ('learned_test@example.com','member');
    `)
    ownerId = (sqlite.prepare("SELECT id FROM users WHERE email='learned_test@example.com'").get() as { id: number }).id
    sqlite.prepare(`INSERT INTO institutions (owner_id, name, kind) VALUES (?, 'Learn Test', 'bank')`).run(ownerId)
    const inst = sqlite.prepare('SELECT id FROM institutions WHERE owner_id = ?').get(ownerId) as { id: number }
    sqlite.prepare(`INSERT INTO bank_accounts (institution_id, owner_id, name, currency) VALUES (?, ?, 'Conto', 'EUR')`).run(inst.id, ownerId)
    accountId = (sqlite.prepare('SELECT id FROM bank_accounts WHERE owner_id = ?').get(ownerId) as { id: number }).id
    const cat = (name: string) => (sqlite.prepare('SELECT id FROM categories WHERE name = ?').get(name) as { id: number }).id
    grocery = cat('Supermercato'); streaming = cat('Abbonamenti')

    const insert = sqlite.prepare(`INSERT INTO transactions
      (owner_id, bank_account_id, booked_date, amount_minor, currency, description_raw, dedup_hash, category_id, category_source)
      VALUES (?, ?, '2026-06-01', ?, 'EUR', ?, ?, ?, ?)`)
    // Nomi inventati: nessun alias merchant né regola li riconosce.
    for (let i = 0; i < 12; i++) insert.run(ownerId, accountId, -3000 - i, 'ZORBAMARKET CENTRO', `l-g-${i}`, grocery, 'manual')
    for (let i = 0; i < 10; i++) insert.run(ownerId, accountId, -999, 'KLOVIFLIX ABBONAMENTO', `l-s-${i}`, streaming, 'legacy')
    insert.run(ownerId, accountId, -3100, 'ZORBAMARKET PERIFERIA', 'l-new', null, 'automatic')
    insert.run(ownerId, accountId, -3100, 'ZORBAMARKET STAZIONE', 'l-kept', streaming, 'automatic')
  })

  afterAll(() => {
    sqlite.prepare('DELETE FROM transactions WHERE owner_id = ?').run(ownerId)
    sqlite.prepare('DELETE FROM bank_accounts WHERE owner_id = ?').run(ownerId)
    sqlite.prepare('DELETE FROM institutions WHERE owner_id = ?').run(ownerId)
    sqlite.prepare('DELETE FROM users WHERE id = ?').run(ownerId)
  })

  test('la revisione propone la categoria appresa solo ai movimenti senza categoria', () => {
    const proposals = previewRecategorization(ownerId, accountId)
    const learned = proposals.filter((p) => p.source === 'learned')
    expect(learned).toHaveLength(1)
    expect(learned[0]).toMatchObject({ description: 'ZORBAMARKET PERIFERIA', categoryId: grocery })
    expect(learned[0].confidence).toBeGreaterThanOrEqual(0.8)
    // Una categoria esistente, anche automatica, non viene sostituita dallo storico.
    expect(proposals.some((p) => p.description === 'ZORBAMARKET STAZIONE')).toBe(false)

    expect(applyRecategorization(ownerId, learned).updated).toBe(1)
    const saved = sqlite.prepare("SELECT category_id, category_source FROM transactions WHERE dedup_hash = 'l-new'").get()
    expect(saved).toEqual({ category_id: grocery, category_source: 'learned' })
  })

  test('import e sync: completa solo le righe rimaste senza categoria', () => {
    const base = { owner_id: ownerId, bank_account_id: accountId, booked_date: '2026-07-01', currency: 'EUR' }
    const rows = fillLearnedCategories(ownerId, [
      { ...base, amount_minor: -1000, description_raw: 'KLOVIFLIX', dedup_hash: 'a', category_id: null, category_source: 'automatic' },
      { ...base, amount_minor: -1000, description_raw: 'KLOVIFLIX', dedup_hash: 'b', category_id: grocery, category_source: 'rule' },
      { ...base, amount_minor: -1000, description_raw: 'SCONOSCIUTO', dedup_hash: 'c', category_id: null, category_source: 'automatic' },
    ])
    expect(rows.map((r) => [r.category_id, r.category_source])).toEqual([
      [streaming, 'learned'], [grocery, 'rule'], [null, 'automatic'],
    ])
  })
})
