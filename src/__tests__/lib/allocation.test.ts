// src/__tests__/lib/allocation.test.ts — Composizione per cluster su un
// portafoglio misto seed. Strumenti in EUR così convertToEur è deterministico
// senza mock FX. Verifica percentuali corrette e gestione posizioni senza prezzo.
import { getPortfolioAllocation } from '@/lib/marketOverview/allocation'
import { sqlite } from '@/db'

let ownerId: number
let portfolioId: number
const symbols = ['ALLOC.STK', 'ALLOC.BND', 'ALLOC.CRY', 'ALLOC.STALE']
const DATE = '2026-07-14'

function instId(symbol: string): number {
  return (sqlite.prepare('SELECT id FROM instruments WHERE symbol = ?').get(symbol) as { id: number }).id
}

beforeAll(() => {
  sqlite.prepare(`INSERT INTO users (email, name, role) VALUES ('alloc@example.com','Alloc','member')`).run()
  ownerId = (sqlite.prepare(`SELECT id FROM users WHERE email='alloc@example.com'`).get() as { id: number }).id

  sqlite.prepare(`INSERT INTO institutions (owner_id, name, kind) VALUES (?, 'Broker', 'broker')`).run(ownerId)
  const inst = (sqlite.prepare('SELECT id FROM institutions WHERE owner_id = ?').get(ownerId) as { id: number }).id
  sqlite.prepare(`INSERT INTO investment_portfolios (owner_id, institution_id, name, currency) VALUES (?, ?, 'P', 'EUR')`).run(ownerId, inst)
  portfolioId = (sqlite.prepare('SELECT id FROM investment_portfolios WHERE owner_id = ?').get(ownerId) as { id: number }).id

  const now = Math.floor(Date.now() / 1000)
  // Prezzo 100 EUR per tutti → MV = quantità × 100.
  const mk = (symbol: string, cluster: string, price: string | null) =>
    sqlite.prepare(
      `INSERT INTO instruments (symbol, name, cluster, currency, price_source, last_price, last_price_at)
       VALUES (?, ?, ?, 'EUR', 'yahoo', ?, ?)`,
    ).run(symbol, symbol, cluster, price, price ? now : null)

  mk('ALLOC.STK', 'stock', '100.00')
  mk('ALLOC.BND', 'bond', '100.00')
  mk('ALLOC.CRY', 'crypto', '100.00')
  mk('ALLOC.STALE', 'etf', null) // senza prezzo → esclusa, hasStalePrices

  const buy = (symbol: string, qty: string) =>
    sqlite.prepare(
      `INSERT INTO investment_txns (owner_id, portfolio_id, instrument_id, type, trade_date, quantity, unit_price, fee_minor, currency)
       VALUES (?, ?, ?, 'buy', '2026-01-01', ?, '100.00', 0, 'EUR')`,
    ).run(ownerId, portfolioId, instId(symbol), qty)

  buy('ALLOC.STK', '6')   // MV 600
  buy('ALLOC.BND', '3')   // MV 300
  buy('ALLOC.CRY', '1')   // MV 100 → totale 1000
  buy('ALLOC.STALE', '5') // senza prezzo
})

afterAll(() => {
  sqlite.prepare('DELETE FROM investment_txns WHERE owner_id = ?').run(ownerId)
  for (const s of symbols) sqlite.prepare('DELETE FROM instruments WHERE symbol = ?').run(s)
  sqlite.prepare('DELETE FROM investment_portfolios WHERE owner_id = ?').run(ownerId)
  sqlite.prepare('DELETE FROM institutions WHERE owner_id = ?').run(ownerId)
  sqlite.prepare('DELETE FROM users WHERE id = ?').run(ownerId)
})

test('percentuali per cluster corrette (60/30/10) e totale in EUR', async () => {
  const res = await getPortfolioAllocation(ownerId, DATE)
  const pct = Object.fromEntries(res.byCluster.map((c) => [c.cluster, Math.round(c.pct)]))
  expect(pct.stock).toBe(60)
  expect(pct.bond).toBe(30)
  expect(pct.crypto).toBe(10)
  expect(res.totalEurMinor).toBe(100000) // 1000 EUR in minor units
})

test('posizione senza prezzo esclusa dal totale ma segnalata', async () => {
  const res = await getPortfolioAllocation(ownerId, DATE)
  expect(res.hasStalePrices).toBe(true)
  // La cluster 'etf' (solo lo strumento stale) non compare
  expect(res.byCluster.find((c) => c.cluster === 'etf')).toBeUndefined()
})

test('somma delle percentuali ~100', async () => {
  const res = await getPortfolioAllocation(ownerId, DATE)
  const sum = res.byCluster.reduce((s, c) => s + c.pct, 0)
  expect(Math.round(sum)).toBe(100)
})
