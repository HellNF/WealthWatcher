// src/__tests__/lib/tax/realized.test.ts — Pure unit tests for realizedSaleEvents.
import { realizedSaleEvents } from '@/lib/tax/realized'
import type { InvestmentTxn } from '@/db/schema'

// ── Helpers ───────────────────────────────────────────────────────────────────

let _id = 0
function makeTxn(
  overrides: Partial<InvestmentTxn> & Pick<InvestmentTxn, 'type' | 'trade_date'>,
): InvestmentTxn {
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

// ── No sells ──────────────────────────────────────────────────────────────────

describe('realizedSaleEvents — no sells', () => {
  test('buy only → no events', () => {
    const txns = [makeTxn({ type: 'buy', trade_date: '2026-01-10', quantity: '10', unit_price: '100.00' })]
    expect(realizedSaleEvents(txns, 'stock', EUR)).toHaveLength(0)
  })

  test('dividend only → no events', () => {
    const txns = [makeTxn({ type: 'dividend', trade_date: '2026-03-01', amount_minor: 500 })]
    expect(realizedSaleEvents(txns, 'stock', EUR)).toHaveLength(0)
  })
})

// ── Single sale ───────────────────────────────────────────────────────────────

describe('realizedSaleEvents — single sale', () => {
  test('buy 10@100, sell 10@120 → grossGain = €200', () => {
    const txns = [
      makeTxn({ type: 'buy',  trade_date: '2026-01-10', quantity: '10', unit_price: '100.00' }),
      makeTxn({ type: 'sell', trade_date: '2026-06-01', quantity: '10', unit_price: '120.00' }),
    ]
    const events = realizedSaleEvents(txns, 'stock', EUR)
    expect(events).toHaveLength(1)
    expect(events[0].grossGainMinor).toBe(20_000)   // (120-100) × 10 × 100
    expect(events[0].date).toBe('2026-06-01')
    expect(events[0].cluster).toBe('stock')
  })

  test('buy 10@100, sell 10@80 → grossGain = -€200 (loss)', () => {
    const txns = [
      makeTxn({ type: 'buy',  trade_date: '2026-01-10', quantity: '10', unit_price: '100.00' }),
      makeTxn({ type: 'sell', trade_date: '2026-06-01', quantity: '10', unit_price: '80.00' }),
    ]
    const events = realizedSaleEvents(txns, 'etf', EUR)
    expect(events[0].grossGainMinor).toBe(-20_000)
    expect(events[0].cluster).toBe('etf')
  })

  test('sell fee reduces proceeds and thus the gain', () => {
    const txns = [
      makeTxn({ type: 'buy',  trade_date: '2026-01-10', quantity: '10', unit_price: '100.00' }),
      makeTxn({ type: 'sell', trade_date: '2026-06-01', quantity: '10', unit_price: '120.00', fee_minor: 500 }),
    ]
    const events = realizedSaleEvents(txns, 'stock', EUR)
    // proceeds = 120000 - 500 = 119500; cost = 100000; gain = 19500
    expect(events[0].grossGainMinor).toBe(19_500)
  })

  test('buy fee increases cost basis and thus reduces the gain', () => {
    const txns = [
      makeTxn({ type: 'buy',  trade_date: '2026-01-10', quantity: '10', unit_price: '100.00', fee_minor: 500 }),
      makeTxn({ type: 'sell', trade_date: '2026-06-01', quantity: '10', unit_price: '120.00' }),
    ]
    const events = realizedSaleEvents(txns, 'stock', EUR)
    // cost = 100000 + 500 = 100500; proceeds = 120000; gain = 19500
    expect(events[0].grossGainMinor).toBe(19_500)
  })
})

// ── Multiple sales ────────────────────────────────────────────────────────────

describe('realizedSaleEvents — multiple sales', () => {
  test('two sells produce two events', () => {
    const txns = [
      makeTxn({ type: 'buy',  trade_date: '2025-01-01', quantity: '20', unit_price: '100.00' }),
      makeTxn({ type: 'sell', trade_date: '2025-06-01', quantity: '10', unit_price: '110.00' }),
      makeTxn({ type: 'sell', trade_date: '2025-12-01', quantity: '10', unit_price: '90.00' }),
    ]
    const events = realizedSaleEvents(txns, 'bond', EUR)
    expect(events).toHaveLength(2)
    expect(events[0].grossGainMinor).toBe(10_000)   // (110-100) × 10 × 100
    expect(events[1].grossGainMinor).toBe(-10_000)  // (90-100) × 10 × 100
  })
})

// ── FIFO order ────────────────────────────────────────────────────────────────

describe('realizedSaleEvents — FIFO order', () => {
  test('consumes first lot first: buy 5@100, buy 5@150, sell 5@200', () => {
    const txns = [
      makeTxn({ type: 'buy',  trade_date: '2025-01-01', quantity: '5', unit_price: '100.00' }),
      makeTxn({ type: 'buy',  trade_date: '2025-06-01', quantity: '5', unit_price: '150.00' }),
      makeTxn({ type: 'sell', trade_date: '2025-12-01', quantity: '5', unit_price: '200.00' }),
    ]
    const events = realizedSaleEvents(txns, 'stock', EUR)
    // First lot consumed: 5×200 - 5×100 = €500 gain = 50000 minor
    expect(events[0].grossGainMinor).toBe(50_000)
  })
})
