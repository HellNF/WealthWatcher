// Giroconti: proposte (anche tra movimenti categorizzati in automatico, mai
// sopra scelte manuali), conferma che assegna la categoria di trasferimento,
// rifiuto definitivo, annullamento e effetto sul contesto delle statistiche.
import { sqlite } from '@/db'
import {
  suggestTransfers, confirmTransfer, rejectTransfer, undoTransfer, listConfirmedTransfers, transferCategoryId,
} from '@/lib/transfers'
import { buildFlowContext } from '@/lib/spending'

let userId: number, checking: number, savings: number
const categoryId = (name: string) => (sqlite.prepare('SELECT id FROM categories WHERE name = ?').get(name) as { id: number }).id

function txn(accountId: number, date: string, amountMinor: number, opts: { category?: number | null; source?: string; currency?: string } = {}): number {
  return Number(sqlite.prepare(
    `INSERT INTO transactions (owner_id, bank_account_id, booked_date, amount_minor, currency, description_raw, dedup_hash, category_id, category_source)
     VALUES (?, ?, ?, ?, ?, 'movimento', ?, ?, ?)`,
  ).run(userId, accountId, date, amountMinor, opts.currency ?? 'EUR', `tr-${Math.random()}`, opts.category ?? null, opts.source ?? 'automatic').lastInsertRowid)
}
const row = (id: number) => sqlite.prepare('SELECT category_id, category_source FROM transactions WHERE id = ?').get(id)
const pairs = () => suggestTransfers(userId).map((p) => [p.outflow.id, p.inflow.id])

beforeAll(() => {
  sqlite.exec(`
    INSERT OR IGNORE INTO allowed_emails (email, role) VALUES ('transfers@example.com','member');
    INSERT OR IGNORE INTO users (email, role) VALUES ('transfers@example.com','member');
  `)
  userId = (sqlite.prepare("SELECT id FROM users WHERE email='transfers@example.com'").get() as { id: number }).id
  sqlite.prepare(`INSERT INTO institutions (owner_id, name, kind) VALUES (?, 'Banca', 'bank')`).run(userId)
  const inst = (sqlite.prepare('SELECT id FROM institutions WHERE owner_id = ?').get(userId) as { id: number }).id
  const account = (name: string) => Number(sqlite.prepare(
    `INSERT INTO bank_accounts (institution_id, owner_id, name, currency) VALUES (?, ?, ?, 'EUR')`,
  ).run(inst, userId, name).lastInsertRowid)
  checking = account('Corrente'); savings = account('Risparmio')
})

afterEach(() => {
  sqlite.prepare('DELETE FROM transfer_links WHERE owner_id = ?').run(userId)
  sqlite.prepare('DELETE FROM transactions WHERE owner_id = ?').run(userId)
})

test('propone coppie speculari su conti diversi, la più vicina nel tempo', () => {
  const out = txn(checking, '2026-05-10', -10_000)
  const near = txn(savings, '2026-05-10', 10_000)
  txn(savings, '2026-05-12', 10_000)                 // più lontana: resta libera
  txn(checking, '2026-05-10', 10_000)                // stesso conto: mai
  txn(savings, '2026-05-10', 10_000 + 1)             // importo diverso
  txn(savings, '2026-05-10', 10_000, { currency: 'USD' }) // valuta diversa
  txn(savings, '2026-05-20', 10_000)                 // oltre la finestra
  expect(pairs()).toEqual([[out, near]])
})

test('include i movimenti categorizzati in automatico, mai le scelte manuali o le regole', () => {
  const wrong = txn(checking, '2026-05-10', -5_000, { category: categoryId('Entrate'), source: 'legacy' })
  const transferIn = txn(savings, '2026-05-10', 5_000, { category: transferCategoryId(), source: 'legacy' })
  expect(pairs()).toEqual([[wrong, transferIn]])
  expect(suggestTransfers(userId)[0].autoExcluded).toBe(false)

  sqlite.prepare("UPDATE transactions SET category_source = 'manual' WHERE id = ?").run(wrong)
  expect(pairs()).toEqual([])
})

test('due lati già trasferimento: niente da proporre', () => {
  txn(checking, '2026-05-10', -5_000, { category: transferCategoryId() })
  txn(savings, '2026-05-10', 5_000, { category: transferCategoryId() })
  expect(pairs()).toEqual([])
})

test('conferma: entrambi diventano trasferimento manuale, la coppia esce dalle proposte', () => {
  const out = txn(checking, '2026-05-10', -10_000, { category: categoryId('Entrate'), source: 'legacy' })
  const inn = txn(savings, '2026-05-11', 10_000)
  expect(confirmTransfer(userId, out, inn)).toEqual({ ok: true })
  expect(row(out)).toEqual({ category_id: transferCategoryId(), category_source: 'manual' })
  expect(row(inn)).toEqual({ category_id: transferCategoryId(), category_source: 'manual' })
  expect(pairs()).toEqual([])
  expect(listConfirmedTransfers(userId).map((c) => [c.outflow.id, c.inflow.id])).toEqual([[out, inn]])
  // Un movimento non può stare in due giroconti confermati.
  const other = txn(savings, '2026-05-11', 10_000)
  expect(confirmTransfer(userId, out, other)).toEqual({ ok: false, error: 'already-confirmed' })
})

test('conferma rifiutata per coppie non speculari o di altri utenti', () => {
  const out = txn(checking, '2026-05-10', -10_000)
  expect(confirmTransfer(userId, out, txn(savings, '2026-05-10', 9_999))).toEqual({ ok: false, error: 'not-a-pair' })
  expect(confirmTransfer(userId, out, txn(checking, '2026-05-10', 10_000))).toEqual({ ok: false, error: 'not-a-pair' })
  expect(confirmTransfer(userId + 999, out, txn(savings, '2026-05-10', 10_000))).toEqual({ ok: false, error: 'not-found' })
})

test('rifiuto: la coppia non viene più proposta né esclusa dalle statistiche', () => {
  const out = txn(checking, '2026-05-10', -10_000)
  const inn = txn(savings, '2026-05-10', 10_000)
  expect(buildFlowContext(userId).pairCount).toBe(1)
  expect(rejectTransfer(userId, out, inn)).toEqual({ ok: true })
  expect(pairs()).toEqual([])
  expect(buildFlowContext(userId)).toMatchObject({ pairCount: 0, excludedIdsJson: '[]' })
})

test('annulla: i movimenti perdono la categoria di trasferimento e tornano proposti', () => {
  const out = txn(checking, '2026-05-10', -10_000)
  const inn = txn(savings, '2026-05-10', 10_000)
  confirmTransfer(userId, out, inn)
  const [{ linkId }] = listConfirmedTransfers(userId)
  expect(undoTransfer(userId + 999, linkId)).toBe(false)
  expect(undoTransfer(userId, linkId)).toBe(true)
  expect(row(out)).toEqual({ category_id: null, category_source: 'automatic' })
  expect(pairs()).toEqual([[out, inn]])
})
