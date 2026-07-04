// src/__tests__/lib/tax/wallet.test.ts — Tests for the fiscal wallet pure helpers.
// computeFiscalWallet uses sqlite (not tested here); simulateOffset is pure.
import { simulateOffset } from '@/lib/tax/wallet'
import type { FiscalWallet } from '@/lib/tax/wallet'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWallet(credits: { realizedDate: string; expiryDate: string; amountMinor: number }[]): FiscalWallet {
  const totalCreditMinor        = credits.reduce((s, c) => s + c.amountMinor, 0)
  const currentYear             = new Date().toISOString().slice(0, 4)
  const expiringThisYearMinor   = credits
    .filter(c => c.expiryDate.startsWith(currentYear))
    .reduce((s, c) => s + c.amountMinor, 0)
  return {
    credits,
    totalCreditMinor,
    expiringThisYearMinor,
    expiredCreditMinor: 0,
  }
}

// ── simulateOffset ────────────────────────────────────────────────────────────

describe('simulateOffset', () => {
  const today = '2026-07-04'

  test('no credits → gain passes through unchanged', () => {
    const wallet  = makeWallet([])
    const result  = simulateOffset(wallet, 10_000, today)
    expect(result.netGainMinor).toBe(10_000)
    expect(result.compensatedMinor).toBe(0)
  })

  test('zero or negative gain → no offset applied', () => {
    const wallet = makeWallet([{ realizedDate: '2025-01-01', expiryDate: '2029-12-31', amountMinor: 50_000 }])
    expect(simulateOffset(wallet, 0,       today).compensatedMinor).toBe(0)
    expect(simulateOffset(wallet, -5_000,  today).compensatedMinor).toBe(0)
  })

  test('credit fully covers the gain', () => {
    const wallet = makeWallet([{ realizedDate: '2025-01-01', expiryDate: '2029-12-31', amountMinor: 50_000 }])
    const result = simulateOffset(wallet, 30_000, today)
    expect(result.netGainMinor).toBe(0)
    expect(result.compensatedMinor).toBe(30_000)
  })

  test('credit partially covers the gain', () => {
    const wallet = makeWallet([{ realizedDate: '2025-01-01', expiryDate: '2029-12-31', amountMinor: 10_000 }])
    const result = simulateOffset(wallet, 30_000, today)
    expect(result.netGainMinor).toBe(20_000)
    expect(result.compensatedMinor).toBe(10_000)
  })

  test('gain fully exhausts the credit', () => {
    const wallet = makeWallet([{ realizedDate: '2025-01-01', expiryDate: '2029-12-31', amountMinor: 30_000 }])
    const result = simulateOffset(wallet, 30_000, today)
    expect(result.netGainMinor).toBe(0)
    expect(result.compensatedMinor).toBe(30_000)
  })

  test('multiple credits consumed FIFO by expiry: oldest first', () => {
    const wallet = makeWallet([
      { realizedDate: '2023-01-01', expiryDate: '2027-12-31', amountMinor: 5_000 },
      { realizedDate: '2024-01-01', expiryDate: '2028-12-31', amountMinor: 5_000 },
    ])
    const result = simulateOffset(wallet, 7_000, today)
    // First credit (expiry 2027): fully used (5000), second: 2000 used
    expect(result.netGainMinor).toBe(0)
    expect(result.compensatedMinor).toBe(7_000)
  })

  test('expired credit is skipped', () => {
    const wallet = makeWallet([
      { realizedDate: '2020-01-01', expiryDate: '2024-12-31', amountMinor: 50_000 }, // expired (2024 < 2026)
      { realizedDate: '2025-01-01', expiryDate: '2029-12-31', amountMinor: 5_000  },
    ])
    const result = simulateOffset(wallet, 20_000, today)
    // Expired credit is skipped; only the active 5000 is used
    expect(result.compensatedMinor).toBe(5_000)
    expect(result.netGainMinor).toBe(15_000)
  })

  test('does NOT mutate the wallet credits', () => {
    const credits = [{ realizedDate: '2025-01-01', expiryDate: '2029-12-31', amountMinor: 50_000 }]
    const wallet  = makeWallet(credits)
    simulateOffset(wallet, 30_000, today)
    // Original credit must be unchanged after simulation
    expect(wallet.credits[0].amountMinor).toBe(50_000)
  })

  test('total compensation cannot exceed the gain', () => {
    const wallet = makeWallet([
      { realizedDate: '2025-01-01', expiryDate: '2027-12-31', amountMinor: 100_000 },
      { realizedDate: '2025-06-01', expiryDate: '2029-12-31', amountMinor: 100_000 },
    ])
    const result = simulateOffset(wallet, 15_000, today)
    expect(result.compensatedMinor).toBe(15_000)
    expect(result.netGainMinor).toBe(0)
  })
})
