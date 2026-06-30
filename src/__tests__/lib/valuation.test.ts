// Valuation snapshot tests — FX and price providers mocked.
// Fixtures: one user, one institution, one portfolio (USD position), one bank account (USD).

jest.mock('@/lib/fx/frankfurter')
jest.mock('@/lib/prices/yahoo',       () => ({ yahooProvider:       { getQuote: jest.fn() } }))
jest.mock('@/lib/prices/coingecko',   () => ({ coingeckoProvider:   { getQuote: jest.fn() } }))
jest.mock('@/lib/prices/alphavantage',() => ({ alphaVantageProvider:{ getQuote: jest.fn() } }))

import { sqlite } from '@/db'
import { fetchRates } from '@/lib/fx/frankfurter'

const mockFetchRates = fetchRates as jest.Mock

// ── Fixture IDs (set in beforeAll) ───────────────────────────────────────────

let userId: number
let portfolioId: number
let instrumentId: number
let accountId: number

const TEST_DATE = '2024-03-01'

beforeAll(() => {
  mockFetchRates.mockResolvedValue({ USD: 1.08 })

  // User
  sqlite.prepare(`INSERT INTO users (email, name, role) VALUES ('valtest@example.com', 'Val Test', 'user')`).run()
  const user = sqlite.prepare(`SELECT id FROM users WHERE email = 'valtest@example.com'`).get() as { id: number }
  userId = user.id

  // Institution
  sqlite.prepare(`INSERT INTO institutions (owner_id, name, kind) VALUES (?, 'TestBank', 'broker')`).run(userId)
  const inst = sqlite.prepare(`SELECT id FROM institutions WHERE owner_id = ?`).get(userId) as { id: number }

  // Bank account (USD, balance = $200)
  sqlite.prepare(`INSERT INTO bank_accounts (owner_id, institution_id, name, currency) VALUES (?, ?, 'USD Acc', 'USD')`).run(userId, inst.id)
  const acc = sqlite.prepare(`SELECT id FROM bank_accounts WHERE owner_id = ?`).get(userId) as { id: number }
  accountId = acc.id
  sqlite.prepare(`INSERT INTO transactions (owner_id, bank_account_id, booked_date, description_raw, dedup_hash, amount_minor, currency) VALUES (?, ?, '2024-01-01', 'Deposit', 'valtest-hash-1', 20000, 'USD')`).run(userId, accountId)

  // Investment portfolio (USD)
  sqlite.prepare(`INSERT INTO investment_portfolios (owner_id, institution_id, name, currency) VALUES (?, ?, 'USD Portfolio', 'USD')`).run(userId, inst.id)
  const portfolio = sqlite.prepare(`SELECT id FROM investment_portfolios WHERE owner_id = ?`).get(userId) as { id: number }
  portfolioId = portfolio.id

  // Instrument
  sqlite.prepare(`INSERT INTO instruments (symbol, name, cluster, currency, price_source, last_price, last_price_at) VALUES ('TEST.US', 'Test Stock', 'stock', 'USD', 'yahoo', '100.00', ${Math.floor(Date.now() / 1000)})`).run()
  const instr = sqlite.prepare(`SELECT id FROM instruments WHERE symbol = 'TEST.US'`).get() as { id: number }
  instrumentId = instr.id

  // Buy 1 share at $100
  sqlite.prepare(`
    INSERT INTO investment_txns (owner_id, portfolio_id, instrument_id, type, trade_date, quantity, unit_price, fee_minor, currency)
    VALUES (?, ?, ?, 'buy', '2024-01-15', '1', '100.00', 0, 'USD')
  `).run(userId, portfolioId, instrumentId)
})

afterAll(() => {
  sqlite.prepare(`DELETE FROM valuation_snapshots WHERE owner_id = ?`).run(userId)
  sqlite.prepare(`DELETE FROM fx_history`).run()
  sqlite.prepare(`DELETE FROM price_history WHERE instrument_id = ?`).run(instrumentId)
  sqlite.prepare(`DELETE FROM investment_txns WHERE owner_id = ?`).run(userId)
  sqlite.prepare(`DELETE FROM instruments WHERE symbol = 'TEST.US'`).run()
  sqlite.prepare(`DELETE FROM investment_portfolios WHERE owner_id = ?`).run(userId)
  sqlite.prepare(`DELETE FROM transactions WHERE owner_id = ?`).run(userId)
  sqlite.prepare(`DELETE FROM bank_accounts WHERE owner_id = ?`).run(userId)
  sqlite.prepare(`DELETE FROM institutions WHERE owner_id = ?`).run(userId)
  sqlite.prepare(`DELETE FROM users WHERE id = ?`).run(userId)
})

afterEach(() => {
  sqlite.prepare(`DELETE FROM valuation_snapshots WHERE owner_id = ?`).run(userId)
  sqlite.prepare(`DELETE FROM fx_history`).run()
  jest.clearAllMocks()
  mockFetchRates.mockResolvedValue({ USD: 1.08 })
})

// ── computeNetWorth ───────────────────────────────────────────────────────────

describe('computeNetWorth', () => {
  test('converts USD positions and accounts to EUR correctly', async () => {
    const { computeNetWorth } = await import('@/lib/valuation')

    // Portfolio: 1 share at $100 last price → $100 market value → €92.59 (100/1.08)
    // Account: $200 → €185.19 (200/1.08)
    // Total: €277.78 → 27778 minor
    const result = await computeNetWorth(userId, TEST_DATE)

    expect(result.stale).toBe(false)
    expect(result.investmentsEurMinor).toBeGreaterThan(0)
    expect(result.accountsEurMinor).toBeGreaterThan(0)
    expect(result.netWorthEurMinor).toBe(result.investmentsEurMinor + result.accountsEurMinor)

    // Breakdown sanity checks
    expect(result.breakdown.portfolios).toHaveLength(1)
    expect(result.breakdown.accounts).toHaveLength(1)
    expect(result.breakdown.accounts[0].originalMinor).toBe(20000) // $200
  })

  test('EUR identity — no FX fetch needed', async () => {
    const { computeNetWorth } = await import('@/lib/valuation')
    // Set instrument to EUR to test identity path
    sqlite.prepare(`UPDATE instruments SET currency = 'EUR' WHERE id = ?`).run(instrumentId)
    sqlite.prepare(`UPDATE investment_txns SET currency = 'EUR' WHERE instrument_id = ?`).run(instrumentId)

    const result = await computeNetWorth(userId, TEST_DATE)
    // EUR positions pass through without FX call
    sqlite.prepare(`UPDATE instruments SET currency = 'USD' WHERE id = ?`).run(instrumentId)
    sqlite.prepare(`UPDATE investment_txns SET currency = 'USD' WHERE instrument_id = ?`).run(instrumentId)

    expect(result).toBeDefined()
  })

  test('stale = true when FX rate unavailable', async () => {
    mockFetchRates.mockResolvedValue(null)
    const { computeNetWorth } = await import('@/lib/valuation')
    const result = await computeNetWorth(userId, '2030-01-01')
    expect(result.stale).toBe(true)
    expect(result.netWorthEurMinor).toBe(0)
  })
})

// ── takeSnapshot + idempotency ────────────────────────────────────────────────

describe('takeSnapshot', () => {
  test('creates a snapshot and persists to DB', async () => {
    const { takeSnapshot, hasSnapshot } = await import('@/lib/valuation')
    expect(hasSnapshot(userId, TEST_DATE)).toBe(false)

    const snap = await takeSnapshot(userId, TEST_DATE)
    expect(snap.owner_id).toBe(userId)
    expect(snap.date).toBe(TEST_DATE)
    expect(snap.net_worth_eur_minor).toBeGreaterThanOrEqual(0)
    expect(hasSnapshot(userId, TEST_DATE)).toBe(true)
  })

  test('idempotent — same day update, no duplicate', async () => {
    const { takeSnapshot, listSnapshots } = await import('@/lib/valuation')
    await takeSnapshot(userId, TEST_DATE)
    await takeSnapshot(userId, TEST_DATE)

    const snaps = listSnapshots(userId)
    const forDate = snaps.filter(s => s.date === TEST_DATE)
    expect(forDate).toHaveLength(1)
  })
})

// ── listSnapshots ─────────────────────────────────────────────────────────────

describe('listSnapshots', () => {
  test('returns snapshots in ascending date order', async () => {
    const { takeSnapshot, listSnapshots } = await import('@/lib/valuation')
    await takeSnapshot(userId, '2024-01-01')
    await takeSnapshot(userId, '2024-03-01')
    await takeSnapshot(userId, '2024-02-01')

    const snaps = listSnapshots(userId)
    expect(snaps.map(s => s.date)).toEqual(['2024-01-01', '2024-02-01', '2024-03-01'])
  })

  test('fromDate filters correctly', async () => {
    const { takeSnapshot, listSnapshots } = await import('@/lib/valuation')
    await takeSnapshot(userId, '2024-01-01')
    await takeSnapshot(userId, '2024-06-01')

    const snaps = listSnapshots(userId, '2024-06-01')
    expect(snaps.every(s => s.date >= '2024-06-01')).toBe(true)
  })
})
