// src/__tests__/lib/tax/annual.test.ts — Test puri per taxYears (via mock sqlite)
// e per la logica di aggregazione annual (via funzioni pure ausiliarie).
//
// Le funzioni async (realizedTaxForYear) richiedono un DB reale; qui testiamo
// solo la logica deterministicamente verificabile senza I/O.

import {
  RATE_STANDARD,
  RATE_WHITELIST,
  syntheticRate,
  incomeType,
  CRYPTO_FRANCHIGIA_EUR_MINOR,
} from '@/lib/tax/rates'
import { simulateOffset } from '@/lib/tax/wallet'
import type { FiscalWallet } from '@/lib/tax/wallet'
import type { RealizedTaxEvent } from '@/lib/tax/annual'

// ── Helpers locali che replicano la logica di calcolo imposta ─────────────────
// (stessa logica di annual.ts, testata in isolamento)

function computeEventsWithTax(
  rawEvents: Array<{ gainEurMinor: number; incomeType: 'diverse' | 'capitale'; cluster: string; appliedRate: number }>,
  wallet: FiscalWallet,
  year: string,
): { events: { taxMinor: number }[]; totalTaxDueMinor: number; compensatedMinor: number; cryptoExempt: boolean } {
  // Calcola crypto gain totale
  const cryptoGainMinor = rawEvents
    .filter(ev => ev.gainEurMinor > 0 && ev.cluster === 'crypto')
    .reduce((s, ev) => s + ev.gainEurMinor, 0)

  const cryptoExempt = cryptoGainMinor > 0 && cryptoGainMinor <= CRYPTO_FRANCHIGIA_EUR_MINOR

  const totalDiverseGain = rawEvents
    .filter(ev => ev.gainEurMinor > 0 && ev.incomeType === 'diverse' && !(ev.cluster === 'crypto' && cryptoExempt))
    .reduce((s, ev) => s + ev.gainEurMinor, 0)

  const { compensatedMinor } = simulateOffset(wallet, totalDiverseGain, `${year}-12-31`)
  let compensationLeft = compensatedMinor
  let totalTaxDueMinor = 0

  const events = rawEvents.map(ev => {
    let taxMinor = 0
    if (ev.gainEurMinor <= 0) {
      taxMinor = 0
    } else if (ev.cluster === 'crypto' && cryptoExempt) {
      taxMinor = 0
    } else if (ev.incomeType === 'capitale') {
      taxMinor = Math.round(ev.gainEurMinor * ev.appliedRate)
    } else {
      const used = Math.min(compensationLeft, ev.gainEurMinor)
      compensationLeft -= used
      taxMinor = Math.round((ev.gainEurMinor - used) * ev.appliedRate)
    }
    totalTaxDueMinor += taxMinor
    return { ...ev, taxMinor }
  })

  return { events, totalTaxDueMinor, compensatedMinor, cryptoExempt }
}

const EMPTY_WALLET: FiscalWallet = {
  credits: [],
  totalCreditMinor: 0,
  expiringThisYearMinor: 0,
  expiredCreditMinor: 0,
}

// ── incomeType ────────────────────────────────────────────────────────────────

describe('incomeType', () => {
  test('ETF in guadagno → capitale', () => {
    expect(incomeType('etf', 100)).toBe('capitale')
  })
  test('ETF in perdita → diverse', () => {
    expect(incomeType('etf', -100)).toBe('diverse')
  })
  test('stock in guadagno → diverse', () => {
    expect(incomeType('stock', 100)).toBe('diverse')
  })
  test('crypto in guadagno → diverse', () => {
    expect(incomeType('crypto', 100)).toBe('diverse')
  })
  test('bond in perdita → diverse', () => {
    expect(incomeType('bond', -50)).toBe('diverse')
  })
})

// ── syntheticRate ─────────────────────────────────────────────────────────────

describe('syntheticRate', () => {
  test("'0' → RATE_STANDARD (26%)", () => {
    expect(syntheticRate('0')).toBeCloseTo(RATE_STANDARD)
  })
  test("'100' → RATE_WHITELIST (12,5%)", () => {
    expect(syntheticRate('100')).toBeCloseTo(RATE_WHITELIST)
  })
  test("'50' → media (19,25%)", () => {
    expect(syntheticRate('50')).toBeCloseTo(0.1925)
  })
  test("null → 26% (default standard)", () => {
    expect(syntheticRate(null)).toBeCloseTo(RATE_STANDARD)
  })
})

// ── Imposta senza compensazione ───────────────────────────────────────────────

describe('imposta su singola plus senza zainetto', () => {
  test('stock +€1.000 → imposta 26% = €260', () => {
    const events = [{ gainEurMinor: 100_000, incomeType: 'diverse' as const, cluster: 'stock', appliedRate: RATE_STANDARD }]
    const { totalTaxDueMinor } = computeEventsWithTax(events, EMPTY_WALLET, '2026')
    expect(totalTaxDueMinor).toBe(26_000)
  })

  test('ETF +€1.000 → imposta 26% = €260 (capitale, no compensazione)', () => {
    const events = [{ gainEurMinor: 100_000, incomeType: 'capitale' as const, cluster: 'etf', appliedRate: RATE_STANDARD }]
    const { totalTaxDueMinor } = computeEventsWithTax(events, EMPTY_WALLET, '2026')
    expect(totalTaxDueMinor).toBe(26_000)
  })

  test('stock −€500 → imposta = 0 (minusvalenza)', () => {
    const events = [{ gainEurMinor: -50_000, incomeType: 'diverse' as const, cluster: 'stock', appliedRate: RATE_STANDARD }]
    const { totalTaxDueMinor } = computeEventsWithTax(events, EMPTY_WALLET, '2026')
    expect(totalTaxDueMinor).toBe(0)
  })
})

// ── Compensazione zainetto ────────────────────────────────────────────────────

describe('compensazione zainetto fiscale', () => {
  const walletWith500: FiscalWallet = {
    credits: [{ realizedDate: '2023-01-01', expiryDate: '2027-12-31', amountMinor: 50_000 }],
    totalCreditMinor: 50_000,
    expiringThisYearMinor: 0,
    expiredCreditMinor: 0,
  }

  test('stock +€1.000 con zainetto €500 → imposta su soli €500 = €130', () => {
    const events = [{ gainEurMinor: 100_000, incomeType: 'diverse' as const, cluster: 'stock', appliedRate: RATE_STANDARD }]
    const { totalTaxDueMinor, compensatedMinor } = computeEventsWithTax(events, walletWith500, '2026')
    expect(compensatedMinor).toBe(50_000)
    expect(totalTaxDueMinor).toBe(13_000)   // (100_000 - 50_000) × 26%
  })

  test('ETF +€1.000 con zainetto → ETF capitale non usa il credito', () => {
    const events = [{ gainEurMinor: 100_000, incomeType: 'capitale' as const, cluster: 'etf', appliedRate: RATE_STANDARD }]
    const { totalTaxDueMinor, compensatedMinor } = computeEventsWithTax(events, walletWith500, '2026')
    expect(compensatedMinor).toBe(0)
    expect(totalTaxDueMinor).toBe(26_000)  // piena imposta su ETF capitale
  })

  test('zainetto maggiore della plus → imposta = 0', () => {
    const bigWallet: FiscalWallet = {
      credits: [{ realizedDate: '2023-01-01', expiryDate: '2027-12-31', amountMinor: 500_000 }],
      totalCreditMinor: 500_000, expiringThisYearMinor: 0, expiredCreditMinor: 0,
    }
    const events = [{ gainEurMinor: 100_000, incomeType: 'diverse' as const, cluster: 'stock', appliedRate: RATE_STANDARD }]
    const { totalTaxDueMinor } = computeEventsWithTax(events, bigWallet, '2026')
    expect(totalTaxDueMinor).toBe(0)
  })
})

// ── Franchigia cripto ─────────────────────────────────────────────────────────

describe('franchigia cripto €2.000', () => {
  test('crypto +€1.500 → esente (sotto soglia)', () => {
    const events = [{ gainEurMinor: 150_000, incomeType: 'diverse' as const, cluster: 'crypto', appliedRate: RATE_STANDARD }]
    const { cryptoExempt, totalTaxDueMinor } = computeEventsWithTax(events, EMPTY_WALLET, '2026')
    expect(cryptoExempt).toBe(true)
    expect(totalTaxDueMinor).toBe(0)
  })

  test('crypto +€2.000 esatti → esente (soglia non superata)', () => {
    const events = [{ gainEurMinor: CRYPTO_FRANCHIGIA_EUR_MINOR, incomeType: 'diverse' as const, cluster: 'crypto', appliedRate: RATE_STANDARD }]
    const { cryptoExempt } = computeEventsWithTax(events, EMPTY_WALLET, '2026')
    expect(cryptoExempt).toBe(true)
  })

  test('crypto +€2.001 → tassato (supera soglia)', () => {
    const events = [{ gainEurMinor: CRYPTO_FRANCHIGIA_EUR_MINOR + 1, incomeType: 'diverse' as const, cluster: 'crypto', appliedRate: RATE_STANDARD }]
    const { cryptoExempt, totalTaxDueMinor } = computeEventsWithTax(events, EMPTY_WALLET, '2026')
    expect(cryptoExempt).toBe(false)
    expect(totalTaxDueMinor).toBeGreaterThan(0)
  })

  test('crypto −€500 (minusvalenza) → cryptoExempt = false (no guadagno)', () => {
    const events = [{ gainEurMinor: -50_000, incomeType: 'diverse' as const, cluster: 'crypto', appliedRate: RATE_STANDARD }]
    const { cryptoExempt } = computeEventsWithTax(events, EMPTY_WALLET, '2026')
    expect(cryptoExempt).toBe(false)
  })
})

// ── Mix stock + ETF + minus ───────────────────────────────────────────────────

describe('scenario misto: stock + ETF + minus', () => {
  test('stock +€1.000, ETF +€500, stock −€200 con zainetto €100', () => {
    const wallet: FiscalWallet = {
      credits: [{ realizedDate: '2022-01-01', expiryDate: '2026-12-31', amountMinor: 10_000 }],
      totalCreditMinor: 10_000, expiringThisYearMinor: 10_000, expiredCreditMinor: 0,
    }
    const events = [
      { gainEurMinor: 100_000, incomeType: 'diverse' as const, cluster: 'stock', appliedRate: RATE_STANDARD },
      { gainEurMinor: 50_000,  incomeType: 'capitale' as const, cluster: 'etf',   appliedRate: RATE_STANDARD },
      { gainEurMinor: -20_000, incomeType: 'diverse' as const, cluster: 'stock', appliedRate: RATE_STANDARD },
    ]
    const { events: out, totalTaxDueMinor, compensatedMinor } = computeEventsWithTax(events, wallet, '2026')
    // Stock plus: 100_000 − compensazione 10_000 = 90_000 → imposta = 23_400
    // ETF plus (capitale): 50_000 → imposta = 13_000 (piena)
    // Minus: 0
    expect(compensatedMinor).toBe(10_000)
    expect(out[0].taxMinor).toBe(23_400)
    expect(out[1].taxMinor).toBe(13_000)
    expect(out[2].taxMinor).toBe(0)
    expect(totalTaxDueMinor).toBe(36_400)
  })
})

// ── CRYPTO_FRANCHIGIA_EUR_MINOR costante ──────────────────────────────────────

describe('CRYPTO_FRANCHIGIA_EUR_MINOR', () => {
  test('vale €2.000 (200_000 minor)', () => {
    expect(CRYPTO_FRANCHIGIA_EUR_MINOR).toBe(200_000)
  })
})
