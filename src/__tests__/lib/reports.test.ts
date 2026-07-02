// src/__tests__/lib/reports.test.ts
import { sqlite } from '@/db'
import { insertBatch } from '@/lib/transactions'
import { monthlyReport, availableMonths } from '@/lib/reports'

let ownerId: number
let accountId: number

beforeAll(() => {
  sqlite.exec(`
    INSERT OR IGNORE INTO allowed_emails (email, role) VALUES ('reports_test@example.com','member');
    INSERT OR IGNORE INTO users (email, role) VALUES ('reports_test@example.com','member');
  `)
  const user = sqlite.prepare("SELECT id FROM users WHERE email='reports_test@example.com'").get() as { id: number }
  ownerId = user.id

  sqlite.prepare('INSERT INTO institutions (owner_id, name, kind) VALUES (?, ?, ?)').run(ownerId, 'Report Bank', 'bank')
  const inst = sqlite.prepare('SELECT id FROM institutions WHERE owner_id = ? ORDER BY id DESC LIMIT 1').get(ownerId) as { id: number }

  sqlite.prepare('INSERT INTO bank_accounts (institution_id, owner_id, name, currency) VALUES (?,?,?,?)').run(inst.id, ownerId, 'Report Conto', 'EUR')
  const acc = sqlite.prepare('SELECT id FROM bank_accounts WHERE owner_id = ? ORDER BY id DESC LIMIT 1').get(ownerId) as { id: number }
  accountId = acc.id

  // Lookup category ids from seed
  const catSuper  = sqlite.prepare("SELECT id FROM categories WHERE name='Supermercato'").get() as { id: number }
  const catRist   = sqlite.prepare("SELECT id FROM categories WHERE name='Ristorante & Bar'").get() as { id: number }
  const catStip   = sqlite.prepare("SELECT id FROM categories WHERE name='Stipendio'").get() as { id: number }

  insertBatch({
    ownerId, bankAccountId: accountId,
    source: 'test', filename: 'report_test.xlsx',
    rows: [
      // June 2026 — outflows
      { owner_id: ownerId, bank_account_id: accountId, booked_date: '2026-06-01', amount_minor: -2500, currency: 'EUR', description_raw: 'Esselunga', dedup_hash: 'r1', category_id: catSuper.id },
      { owner_id: ownerId, bank_account_id: accountId, booked_date: '2026-06-05', amount_minor: -3200, currency: 'EUR', description_raw: 'Coop', dedup_hash: 'r2', category_id: catSuper.id },
      { owner_id: ownerId, bank_account_id: accountId, booked_date: '2026-06-10', amount_minor: -4500, currency: 'EUR', description_raw: 'Ristorante Mario', dedup_hash: 'r3', category_id: catRist.id },
      // June 2026 — inflow
      { owner_id: ownerId, bank_account_id: accountId, booked_date: '2026-06-28', amount_minor: 250000, currency: 'EUR', description_raw: 'Stipendio', dedup_hash: 'r4', category_id: catStip.id },
      // May 2026
      { owner_id: ownerId, bank_account_id: accountId, booked_date: '2026-05-15', amount_minor: -1800, currency: 'EUR', description_raw: 'Amazon', dedup_hash: 'r5', category_id: null },
    ],
  })
})

afterAll(() => {
  sqlite.exec(`DELETE FROM transactions    WHERE owner_id = ${ownerId}`)
  sqlite.exec(`DELETE FROM import_batches  WHERE owner_id = ${ownerId}`)
  sqlite.exec(`DELETE FROM bank_accounts   WHERE owner_id = ${ownerId}`)
  sqlite.exec(`DELETE FROM institutions    WHERE owner_id = ${ownerId}`)
  sqlite.exec(`DELETE FROM users           WHERE id = ${ownerId}`)
})

describe('monthlyReport', () => {
  test('totals are correct for June 2026', () => {
    const r = monthlyReport(ownerId, '2026-06')
    expect(r.totalOutflow).toBe(-2500 - 3200 - 4500) // -10200
    expect(r.totalInflow).toBe(250000)
  })

  test('byCategory groups outflows only', () => {
    const r = monthlyReport(ownerId, '2026-06')
    // Only expense categories, no inflow rows
    expect(r.byCategory.every((c) => c.total_minor < 0)).toBe(true)
    const superCat = r.byCategory.find((c) => c.category_name === 'Supermercato')
    expect(superCat?.total_minor).toBe(-5700) // -2500 + -3200
    const ristCat = r.byCategory.find((c) => c.category_name === 'Ristorante & Bar')
    expect(ristCat?.total_minor).toBe(-4500)
  })

  test('May 2026 report only includes May transactions', () => {
    const r = monthlyReport(ownerId, '2026-05')
    expect(r.totalOutflow).toBe(-1800)
    expect(r.totalInflow).toBe(0)
  })

  test('bankAccountId filter isolates by account', () => {
    // No data for a non-existent account
    const r = monthlyReport(ownerId, '2026-06', 999999)
    expect(r.totalOutflow).toBe(0)
    expect(r.totalInflow).toBe(0)
  })

  test('unknown month returns zeros', () => {
    const r = monthlyReport(ownerId, '2020-01')
    expect(r.totalOutflow).toBe(0)
    expect(r.totalInflow).toBe(0)
    expect(r.byCategory).toHaveLength(0)
  })
})

describe('availableMonths', () => {
  test('returns months in descending order', () => {
    const months = availableMonths(ownerId)
    expect(months).toEqual(['2026-06', '2026-05'])
  })

  test('filters by account', () => {
    const months = availableMonths(ownerId, accountId)
    expect(months).toHaveLength(2)
    const months2 = availableMonths(ownerId, 999999)
    expect(months2).toHaveLength(0)
  })
})
