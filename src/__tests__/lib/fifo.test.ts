// src/__tests__/lib/fifo.test.ts — FIFO engine unit tests (pure, no DB).
import { runFifo, computePosition } from '@/lib/investments/fifo'
import { fromMinor } from '@/lib/money'
import type { InvestmentTxn } from '@/db/schema'

// ── Helpers ───────────────────────────────────────────────────────────────────

let _id = 0
function makeTxn(overrides: Partial<InvestmentTxn> & Pick<InvestmentTxn, 'type' | 'trade_date'>): InvestmentTxn {
  return {
    id:            ++_id,
    owner_id:      1,
    portfolio_id:  1,
    instrument_id: 1,
    quantity:      null,
    unit_price:    null,
    fee_minor:     0,
    amount_minor:  null,
    currency:      'EUR',
    note:          null,
    created_at:    0,
    ...overrides,
  }
}

const EUR = 'EUR'

// ── Buy only ──────────────────────────────────────────────────────────────────

describe('runFifo — buy only', () => {
  test('single buy: correct qty, costBasis = qty×price + fee', () => {
    const txns = [makeTxn({ type: 'buy', trade_date: '2026-01-10', quantity: '10', unit_price: '100.00', fee_minor: 500 })]
    const state = runFifo(txns, EUR)
    expect(state.remainingQty).toBe('10')
    expect(state.costBasisMinor).toBe(100_000 + 500) // 10×€100 = €1000 = 100000 minor + €5 fee
    expect(state.realizedPlMinor).toBe(0)
  })

  test('two buys: lots accumulate correctly', () => {
    const txns = [
      makeTxn({ type: 'buy', trade_date: '2026-01-10', quantity: '5', unit_price: '100.00', fee_minor: 0 }),
      makeTxn({ type: 'buy', trade_date: '2026-01-20', quantity: '5', unit_price: '110.00', fee_minor: 0 }),
    ]
    const state = runFifo(txns, EUR)
    expect(state.remainingQty).toBe('10')
    // 5×100 + 5×110 = 1050 EUR = 105000 minor
    expect(state.costBasisMinor).toBe(105_000)
    expect(state.lots).toHaveLength(2)
  })
})

// ── Full sell ─────────────────────────────────────────────────────────────────

describe('runFifo — full sell', () => {
  test('buy 10 @ €100, sell 10 @ €120 → realizedPL = €200', () => {
    const txns = [
      makeTxn({ type: 'buy',  trade_date: '2026-01-10', quantity: '10', unit_price: '100.00', fee_minor: 0 }),
      makeTxn({ type: 'sell', trade_date: '2026-02-01', quantity: '10', unit_price: '120.00', fee_minor: 0 }),
    ]
    const state = runFifo(txns, EUR)
    expect(state.remainingQty).toBe('0')
    expect(state.costBasisMinor).toBe(0)
    // proceeds = 10×120 = €1200 = 120000 minor; cost = €1000 = 100000 minor
    expect(state.realizedPlMinor).toBe(20_000)
    expect(fromMinor(state.realizedPlMinor, EUR)).toBe('200.00')
  })

  test('sell fee reduces proceeds, so realizedPL is lower', () => {
    const txns = [
      makeTxn({ type: 'buy',  trade_date: '2026-01-10', quantity: '10', unit_price: '100.00', fee_minor: 0 }),
      makeTxn({ type: 'sell', trade_date: '2026-02-01', quantity: '10', unit_price: '120.00', fee_minor: 500 }),
    ]
    const state = runFifo(txns, EUR)
    // proceeds = 120000 - 500 = 119500; cost = 100000 → PL = 19500
    expect(state.realizedPlMinor).toBe(19_500)
  })
})

// ── Partial sell (FIFO order) ─────────────────────────────────────────────────

describe('runFifo — partial sell FIFO', () => {
  test('buy 5@100, buy 5@110, sell 5@130 → consumes first lot first', () => {
    const txns = [
      makeTxn({ type: 'buy',  trade_date: '2026-01-10', quantity: '5', unit_price: '100.00', fee_minor: 0 }),
      makeTxn({ type: 'buy',  trade_date: '2026-01-20', quantity: '5', unit_price: '110.00', fee_minor: 0 }),
      makeTxn({ type: 'sell', trade_date: '2026-03-01', quantity: '5', unit_price: '130.00', fee_minor: 0 }),
    ]
    const state = runFifo(txns, EUR)
    // Remaining: 5 shares of the second lot
    expect(state.remainingQty).toBe('5')
    expect(state.lots).toHaveLength(1)
    // Cost of remaining = 5×110 = 55000 minor
    expect(state.costBasisMinor).toBe(55_000)
    // PL from selling first lot: 5×130 - 5×100 = 150 EUR = 15000 minor
    expect(state.realizedPlMinor).toBe(15_000)
  })

  test('partial sell consumes fractional lot correctly', () => {
    const txns = [
      makeTxn({ type: 'buy',  trade_date: '2026-01-10', quantity: '10', unit_price: '100.00', fee_minor: 0 }),
      makeTxn({ type: 'sell', trade_date: '2026-02-01', quantity: '3',  unit_price: '120.00', fee_minor: 0 }),
    ]
    const state = runFifo(txns, EUR)
    expect(state.remainingQty).toBe('7')
    // Remaining cost = 7/10 × 100000 = 70000 minor
    expect(state.costBasisMinor).toBe(70_000)
    // PL = 3×120 - 3×100 = 60 EUR = 6000 minor
    expect(state.realizedPlMinor).toBe(6_000)
  })
})

// ── Dividend & fee ────────────────────────────────────────────────────────────

describe('runFifo — dividend and fee', () => {
  test('dividend adds to income, does not affect lots', () => {
    const txns = [
      makeTxn({ type: 'buy',      trade_date: '2026-01-10', quantity: '10', unit_price: '100.00', fee_minor: 0 }),
      makeTxn({ type: 'dividend', trade_date: '2026-03-01', amount_minor: 2000 }),
    ]
    const state = runFifo(txns, EUR)
    expect(state.dividendIncomeMinor).toBe(2000)
    expect(state.remainingQty).toBe('10') // lots unchanged
  })

  test('standalone fee tracked separately', () => {
    const txns = [
      makeTxn({ type: 'buy', trade_date: '2026-01-10', quantity: '10', unit_price: '100.00', fee_minor: 0 }),
      makeTxn({ type: 'fee', trade_date: '2026-12-31', amount_minor: 1000 }),
    ]
    const state = runFifo(txns, EUR)
    expect(state.feesMinor).toBe(1000)
  })
})

// ── No float drift ────────────────────────────────────────────────────────────

describe('runFifo — no floating point drift', () => {
  test('fractional price × fractional qty produces exact integer', () => {
    const txns = [
      makeTxn({ type: 'buy',  trade_date: '2026-01-10', quantity: '3.33', unit_price: '33.33', fee_minor: 0 }),
      makeTxn({ type: 'sell', trade_date: '2026-02-01', quantity: '3.33', unit_price: '40.00', fee_minor: 0 }),
    ]
    const state = runFifo(txns, EUR)
    // realizedPL and costBasis must be integers (minor units) with no NaN/Infinity
    expect(Number.isInteger(state.realizedPlMinor)).toBe(true)
    expect(Number.isInteger(state.costBasisMinor)).toBe(true)
    expect(Number.isNaN(state.realizedPlMinor)).toBe(false)
  })
})

// ── computePosition ───────────────────────────────────────────────────────────

describe('computePosition', () => {
  const instrument = {
    id: 0, symbol: 'VWCE.DE', name: 'Vanguard FTSE All-World',
    currency: 'EUR', provider_symbol: null, last_price: null, last_price_at: null,
  }

  test('no price → marketValue and unrealizedPl are null (stale)', () => {
    const txns = [makeTxn({ type: 'buy', trade_date: '2026-01-10', quantity: '10', unit_price: '100.00', fee_minor: 0 })]
    const state = runFifo(txns, EUR)
    const pos = computePosition(instrument, state)
    expect(pos.marketValueMinor).toBeNull()
    expect(pos.unrealizedPlMinor).toBeNull()
    expect(pos.unrealizedPlPct).toBeNull()
  })

  test('with price → correct unrealizedPl and pct', () => {
    const txns = [makeTxn({ type: 'buy', trade_date: '2026-01-10', quantity: '10', unit_price: '100.00', fee_minor: 0 })]
    const state = runFifo(txns, EUR)
    const pos = computePosition({ ...instrument, last_price: '120.00', last_price_at: 1_000_000 }, state)
    // market = 10 × 120 = 1200 EUR = 120000 minor
    expect(pos.marketValueMinor).toBe(120_000)
    // unrealized = 120000 - 100000 = 20000 minor = €200
    expect(pos.unrealizedPlMinor).toBe(20_000)
    // pct = 20000/100000 × 100 = 20.00%
    expect(pos.unrealizedPlPct).toBe('20.00')
  })

  test('zero remaining qty → marketValue is null even if price exists', () => {
    const txns = [
      makeTxn({ type: 'buy',  trade_date: '2026-01-10', quantity: '10', unit_price: '100.00', fee_minor: 0 }),
      makeTxn({ type: 'sell', trade_date: '2026-02-01', quantity: '10', unit_price: '120.00', fee_minor: 0 }),
    ]
    const state = runFifo(txns, EUR)
    const pos = computePosition({ ...instrument, last_price: '120.00', last_price_at: 1_000_000 }, state)
    expect(pos.marketValueMinor).toBeNull()
  })
})
