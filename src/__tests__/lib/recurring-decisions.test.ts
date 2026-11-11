// Decisioni sui ricorrenti: conferma (segnata), scarto (sparisce da tutti i
// consumatori di transactionStats), ripristino, validazione della chiave.
import { sqlite } from '@/db'
import { transactionStats, detectRecurring } from '@/lib/analytics'
import {
  setRecurringDecision, clearRecurringDecision, listRecurringDecisions, isValidRecurringKey,
} from '@/lib/recurringDecisions'

let userId: number

function monthsAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(5)
  d.setUTCMonth(d.getUTCMonth() - n)
  return d.toISOString().slice(0, 10)
}

beforeAll(() => {
  sqlite.exec(`
    INSERT OR IGNORE INTO allowed_emails (email, role) VALUES ('recurring@example.com','member');
    INSERT OR IGNORE INTO users (email, role) VALUES ('recurring@example.com','member');
  `)
  userId = (sqlite.prepare("SELECT id FROM users WHERE email='recurring@example.com'").get() as { id: number }).id
  const inst = Number(sqlite.prepare(`INSERT INTO institutions (owner_id, name, kind) VALUES (?, 'Banca', 'bank')`).run(userId).lastInsertRowid)
  const account = Number(sqlite.prepare(`INSERT INTO bank_accounts (institution_id, owner_id, name, currency) VALUES (?, ?, 'Conto', 'EUR')`).run(inst, userId).lastInsertRowid)
  const insert = sqlite.prepare(
    `INSERT INTO transactions (owner_id, bank_account_id, booked_date, amount_minor, currency, description_raw, dedup_hash)
     VALUES (?, ?, ?, ?, 'EUR', ?, ?)`)
  for (let m = 6; m >= 1; m--) {
    insert.run(userId, account, monthsAgo(m), -1299, 'STREAMFLIX ABBONAMENTO', `rd-s-${m}`)
    insert.run(userId, account, monthsAgo(m), -4500, 'PALESTRA CORPOLIBERO', `rd-g-${m}`)
  }
})

afterEach(() => { sqlite.prepare('DELETE FROM recurring_decisions WHERE owner_id = ?').run(userId) })

const keys = () => transactionStats(userId).recurring.map((r) => [r.description, r.confirmed ?? false])

test('senza decisioni: entrambi rilevati come proposte', () => {
  expect(keys()).toEqual(expect.arrayContaining([['streamflix abbonamento', false], ['palestra corpolibero', false]]))
})

test('conferma: il ricorrente resta ed è segnato come confermato', () => {
  const streaming = transactionStats(userId).recurring.find((r) => r.description.startsWith('streamflix'))!
  setRecurringDecision(userId, streaming.key, 'Streamflix', 'confirmed')
  expect(keys()).toEqual(expect.arrayContaining([['streamflix abbonamento', true], ['palestra corpolibero', false]]))
})

test('scarto: sparisce dai ricorrenti; ripristino lo fa tornare', () => {
  const gym = transactionStats(userId).recurring.find((r) => r.description.startsWith('palestra'))!
  setRecurringDecision(userId, gym.key, 'Palestra', 'dismissed')
  expect(keys().map(([d]) => d)).not.toContain('palestra corpolibero')
  expect(listRecurringDecisions(userId).get(gym.key)).toEqual({ status: 'dismissed', label: 'Palestra' })
  clearRecurringDecision(userId, gym.key)
  expect(keys().map(([d]) => d)).toContain('palestra corpolibero')
})

test('lo scarto non toglie posti: viene applicato prima del limite di 25', () => {
  const expenses = Array.from({ length: 30 }, (_, i) => Array.from({ length: 4 }, (_, m) => ({
    id: i * 10 + m, booked_date: monthsAgo(4 - m), amount_minor: -(10_000 + i * 100), bank_account_id: 1,
    description_raw: `SERVIZIO NUMERO ${String.fromCharCode(65 + i)}`, category_id: null, category_name: null,
    category_kind: null, merchant_id: null, merchant_name: null,
  }))).flat().sort((a, b) => a.booked_date.localeCompare(b.booked_date))
  const all = detectRecurring(expenses as never)
  expect(all).toHaveLength(25)
  const withoutFirst = detectRecurring(expenses as never, new Date(), new Set([all[0].key]))
  expect(withoutFirst).toHaveLength(25)
  expect(withoutFirst.map((r) => r.key)).not.toContain(all[0].key)
})

test('chiavi valide solo nel formato del rilevamento', () => {
  expect(isValidRecurringKey('m:12')).toBe(true)
  expect(isValidRecurringKey('d:netflix com')).toBe(true)
  expect(isValidRecurringKey('x:1')).toBe(false)
  expect(isValidRecurringKey('m:')).toBe(false)
  expect(isValidRecurringKey(42)).toBe(false)
})
