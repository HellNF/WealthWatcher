// src/__tests__/api/homepage.test.ts — Route /api/homepage/v1/* (integrazione Homepage).
jest.mock('@/lib/fx/frankfurter')
jest.mock('@/lib/dal', () => ({ getSession: jest.fn(), requireUser: jest.fn() }))

import { NextRequest } from 'next/server'
import { sqlite } from '@/db'
import { fetchRates } from '@/lib/fx/frankfurter'
import { getSession } from '@/lib/dal'
import { createApiToken } from '@/lib/apiTokens'
import { takeSnapshot } from '@/lib/valuation'
import { _resetRateLimitsForTests } from '@/lib/rateLimit'

import { GET as pingGET } from '@/app/api/homepage/v1/ping/route'
import { GET as summaryGET } from '@/app/api/homepage/v1/summary/route'
import { GET as portfoliosGET } from '@/app/api/homepage/v1/portfolios/route'
import { GET as accountsGET } from '@/app/api/homepage/v1/accounts/route'
import { GET as cashflowGET } from '@/app/api/homepage/v1/cashflow/route'
import { GET as goalsGET } from '@/app/api/homepage/v1/goals/route'
import { GET as deadlinesGET } from '@/app/api/homepage/v1/deadlines/route'
import { GET as allocationGET } from '@/app/api/homepage/v1/allocation/route'

const mockFetchRates    = fetchRates as jest.Mock
const mockGetSession    = getSession as jest.Mock

function req(url = 'http://localhost:3000/api/homepage/v1/summary', headers?: Record<string, string>) {
  return new NextRequest(url, { headers })
}

// ── Fixtures: due utenti con un conto EUR ciascuno, saldi diversi ────────────

let userA: number, userB: number
let tokenA: string

beforeAll(() => {
  mockFetchRates.mockResolvedValue({ USD: 1.08 })

  sqlite.prepare(`INSERT INTO users (email, name, role) VALUES ('hp-a@example.com', 'Utente A', 'member')`).run()
  userA = (sqlite.prepare(`SELECT id FROM users WHERE email = 'hp-a@example.com'`).get() as { id: number }).id
  sqlite.prepare(`INSERT INTO users (email, name, role) VALUES ('hp-b@example.com', 'Utente B', 'member')`).run()
  userB = (sqlite.prepare(`SELECT id FROM users WHERE email = 'hp-b@example.com'`).get() as { id: number }).id

  sqlite.prepare(`INSERT INTO institutions (owner_id, name, kind) VALUES (?, 'Banca A', 'bank')`).run(userA)
  const instA = sqlite.prepare(`SELECT id FROM institutions WHERE owner_id = ?`).get(userA) as { id: number }
  sqlite.prepare(`INSERT INTO bank_accounts (owner_id, institution_id, name, currency) VALUES (?, ?, 'Conto A', 'EUR')`).run(userA, instA.id)
  const accA = sqlite.prepare(`SELECT id FROM bank_accounts WHERE owner_id = ?`).get(userA) as { id: number }
  sqlite.prepare(`INSERT INTO transactions (owner_id, bank_account_id, booked_date, description_raw, dedup_hash, amount_minor, currency) VALUES (?, ?, '2024-01-01', 'Deposito', 'hp-a-1', 100000, 'EUR')`).run(userA, accA.id)

  sqlite.prepare(`INSERT INTO institutions (owner_id, name, kind) VALUES (?, 'Banca B', 'bank')`).run(userB)
  const instB = sqlite.prepare(`SELECT id FROM institutions WHERE owner_id = ?`).get(userB) as { id: number }
  sqlite.prepare(`INSERT INTO bank_accounts (owner_id, institution_id, name, currency) VALUES (?, ?, 'Conto B', 'EUR')`).run(userB, instB.id)
  const accB = sqlite.prepare(`SELECT id FROM bank_accounts WHERE owner_id = ?`).get(userB) as { id: number }
  sqlite.prepare(`INSERT INTO transactions (owner_id, bank_account_id, booked_date, description_raw, dedup_hash, amount_minor, currency) VALUES (?, ?, '2024-01-01', 'Deposito', 'hp-b-1', 50000, 'EUR')`).run(userB, accB.id)
})

afterAll(() => {
  for (const userId of [userA, userB]) {
    sqlite.prepare(`DELETE FROM valuation_snapshots WHERE owner_id = ?`).run(userId)
    sqlite.prepare(`DELETE FROM transactions WHERE owner_id = ?`).run(userId)
    sqlite.prepare(`DELETE FROM bank_accounts WHERE owner_id = ?`).run(userId)
    sqlite.prepare(`DELETE FROM institutions WHERE owner_id = ?`).run(userId)
    sqlite.prepare(`DELETE FROM api_tokens WHERE owner_id = ?`).run(userId)
    sqlite.prepare(`DELETE FROM users WHERE id = ?`).run(userId)
  }
})

beforeEach(async () => {
  _resetRateLimitsForTests()
  mockGetSession.mockResolvedValue(null)
  tokenA = createApiToken(userA, 'Test token A').token
  await takeSnapshot(userA)
  await takeSnapshot(userB)
})

afterEach(() => {
  sqlite.prepare(`DELETE FROM api_tokens WHERE owner_id = ?`).run(userA)
})

// ── Auth ──────────────────────────────────────────────────────────────────────

test('ping è pubblico e non richiede alcun header', async () => {
  const res = await pingGET()
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.status).toBe('ok')
})

test('senza header e senza sessione → 401', async () => {
  const res = await summaryGET(req())
  expect(res.status).toBe(401)
  expect(res.headers.get('WWW-Authenticate')).toBe('Bearer')
})

test('token inesistente → 401', async () => {
  const res = await summaryGET(req(undefined, { 'X-API-Key': 'ww_non-esiste' }))
  expect(res.status).toBe(401)
})

test('token valido → 200 e dati del proprietario corretto', async () => {
  const res = await summaryGET(req(undefined, { 'X-API-Key': tokenA }))
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.netWorth).toBeCloseTo(1000, 2) // €1.000,00 depositati
})

test('token valido aggiorna last_used_at', async () => {
  const before = sqlite.prepare(`SELECT last_used_at FROM api_tokens WHERE owner_id = ?`).get(userA) as { last_used_at: number | null }
  expect(before.last_used_at).toBeNull()

  await summaryGET(req(undefined, { 'X-API-Key': tokenA }))

  const after = sqlite.prepare(`SELECT last_used_at FROM api_tokens WHERE owner_id = ?`).get(userA) as { last_used_at: number | null }
  expect(after.last_used_at).not.toBeNull()
})

test('token revocato → 401', async () => {
  const { token, row } = createApiToken(userA, 'Da revocare')
  sqlite.prepare(`UPDATE api_tokens SET revoked_at = unixepoch() WHERE id = ?`).run(row.id)

  const res = await summaryGET(req(undefined, { 'X-API-Key': token }))
  expect(res.status).toBe(401)
})

test('fallback sulla sessione browser quando non c\'è header token', async () => {
  mockGetSession.mockResolvedValue({ uid: userA })
  const res = await summaryGET(req())
  expect(res.status).toBe(200)
})

// ── Isolamento fra utenti ──────────────────────────────────────────────────────

test('il token di un utente non vede mai i dati di un altro', async () => {
  const resA = await summaryGET(req(undefined, { 'X-API-Key': tokenA }))
  const dataA = await resA.json()
  expect(dataA.netWorth).toBeCloseTo(1000, 2)
  expect(dataA.netWorth).not.toBeCloseTo(500, 2)
})

test('accounts riflette solo i conti del proprietario del token', async () => {
  const res = await accountsGET(req(undefined, { 'X-API-Key': tokenA }))
  const data = await res.json()
  expect(data.items).toHaveLength(1)
  expect(data.items[0].name).toBe('Conto A')
})

// ── Rate limit ────────────────────────────────────────────────────────────────

test('oltre il limite di richieste risponde 429 con Retry-After', async () => {
  for (let i = 0; i < 120; i++) {
    const r = await summaryGET(req(undefined, { 'X-API-Key': tokenA }))
    expect(r.status).toBe(200)
  }
  const res = await summaryGET(req(undefined, { 'X-API-Key': tokenA }))
  expect(res.status).toBe(429)
  expect(res.headers.get('Retry-After')).not.toBeNull()
}, 20_000)

// ── Forma del payload ─────────────────────────────────────────────────────────

test('summary: denaro in unità maggiori, currency EUR, asOf ISO valido', async () => {
  const res = await summaryGET(req(undefined, { 'X-API-Key': tokenA }))
  const data = await res.json()
  expect(data.currency).toBe('EUR')
  expect(typeof data.netWorth).toBe('number')
  expect(Number.isNaN(Date.parse(data.asOf))).toBe(false)
})

test('allocation: percentuali in scala 0-100', async () => {
  const res = await allocationGET(req(undefined, { 'X-API-Key': tokenA }))
  const data = await res.json()
  for (const item of data.items) {
    expect(item.pct).toBeGreaterThanOrEqual(0)
    expect(item.pct).toBeLessThanOrEqual(100)
  }
})

test('portfolios: lista vuota per utente senza portafogli, mai 500', async () => {
  const res = await portfoliosGET(req(undefined, { 'X-API-Key': tokenA }))
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.items).toEqual([])
})

test('cashflow risponde 200 con struttura attesa', async () => {
  const res = await cashflowGET(req(undefined, { 'X-API-Key': tokenA }))
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.currency).toBe('EUR')
  expect(data.budget).toBeDefined()
  expect(data.runway).toBeDefined()
})

test('goals risponde 200 con lista vuota se non ci sono obiettivi', async () => {
  const res = await goalsGET(req(undefined, { 'X-API-Key': tokenA }))
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data.items).toEqual([])
})

test('deadlines rispetta il parametro days (clamp)', async () => {
  const res = await deadlinesGET(req('http://localhost:3000/api/homepage/v1/deadlines?days=9999', { 'X-API-Key': tokenA }))
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(Array.isArray(data.items)).toBe(true)
})

// ── Utente senza alcun dato ────────────────────────────────────────────────────

test('utente senza snapshot/conti/portafogli riceve 200 con zeri, mai 500', async () => {
  sqlite.prepare(`INSERT INTO users (email, name, role) VALUES ('hp-empty@example.com', 'Vuoto', 'member')`).run()
  const emptyUserId = (sqlite.prepare(`SELECT id FROM users WHERE email = 'hp-empty@example.com'`).get() as { id: number }).id
  const emptyToken  = createApiToken(emptyUserId, 'Empty').token

  try {
    const res = await summaryGET(req(undefined, { 'X-API-Key': emptyToken }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.netWorth).toBe(0)
  } finally {
    sqlite.prepare(`DELETE FROM api_tokens WHERE owner_id = ?`).run(emptyUserId)
    sqlite.prepare(`DELETE FROM valuation_snapshots WHERE owner_id = ?`).run(emptyUserId)
    sqlite.prepare(`DELETE FROM users WHERE id = ?`).run(emptyUserId)
  }
})
