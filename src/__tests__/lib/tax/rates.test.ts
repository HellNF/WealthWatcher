// src/__tests__/lib/tax/rates.test.ts — Pure unit tests for the Italian tax rates module.
import { syntheticRate, expiryDate, incomeType, RATE_STANDARD, RATE_WHITELIST, CRYPTO_FRANCHIGIA_EUR_MINOR } from '@/lib/tax/rates'

// ── Constants ─────────────────────────────────────────────────────────────────

describe('constants', () => {
  test('RATE_STANDARD is 26%', () => {
    expect(RATE_STANDARD).toBeCloseTo(0.26)
  })

  test('RATE_WHITELIST is 12.5%', () => {
    expect(RATE_WHITELIST).toBeCloseTo(0.125)
  })

  test('CRYPTO_FRANCHIGIA_EUR_MINOR is €2,000 in minor units', () => {
    expect(CRYPTO_FRANCHIGIA_EUR_MINOR).toBe(200_000)
  })
})

// ── syntheticRate ─────────────────────────────────────────────────────────────

describe('syntheticRate', () => {
  test('0% whitelist → 26% (full standard rate)', () => {
    expect(syntheticRate('0')).toBeCloseTo(0.26, 10)
  })

  test('100% whitelist → 12.5% (full agevolata rate)', () => {
    expect(syntheticRate('100')).toBeCloseTo(0.125, 10)
  })

  test('50% whitelist → 19.25% (midpoint)', () => {
    // α = 0.5 × 0.125 + 0.5 × 0.26 = 0.0625 + 0.13 = 0.1925
    expect(syntheticRate('50')).toBeCloseTo(0.1925, 10)
  })

  test('25% whitelist → 22.375%', () => {
    // α = 0.25 × 0.125 + 0.75 × 0.26 = 0.03125 + 0.195 = 0.22625
    expect(syntheticRate('25')).toBeCloseTo(0.22625, 10)
  })

  test('null/undefined/empty → falls back to 26%', () => {
    expect(syntheticRate(null)).toBeCloseTo(0.26, 10)
    expect(syntheticRate(undefined)).toBeCloseTo(0.26, 10)
    expect(syntheticRate('')).toBeCloseTo(0.26, 10)
  })

  test('values above 100 are clamped to 12.5%', () => {
    expect(syntheticRate('200')).toBeCloseTo(0.125, 10)
  })

  test('negative values are clamped to 26%', () => {
    expect(syntheticRate('-10')).toBeCloseTo(0.26, 10)
  })

  test('returns a plain JS number (not Decimal)', () => {
    const r = syntheticRate('50')
    expect(typeof r).toBe('number')
  })
})

// ── expiryDate ────────────────────────────────────────────────────────────────

describe('expiryDate', () => {
  test('2026-03-12 → 2030-12-31', () => {
    expect(expiryDate('2026-03-12')).toBe('2030-12-31')
  })

  test('2026-12-31 → 2030-12-31', () => {
    expect(expiryDate('2026-12-31')).toBe('2030-12-31')
  })

  test('2026-01-01 → 2030-12-31', () => {
    expect(expiryDate('2026-01-01')).toBe('2030-12-31')
  })

  test('2023-06-15 → 2027-12-31', () => {
    expect(expiryDate('2023-06-15')).toBe('2027-12-31')
  })

  test('2020-01-01 → 2024-12-31', () => {
    expect(expiryDate('2020-01-01')).toBe('2024-12-31')
  })

  test('throws on invalid date', () => {
    expect(() => expiryDate('not-a-date')).toThrow()
  })
})

// ── incomeType ────────────────────────────────────────────────────────────────

describe('incomeType', () => {
  test('ETF gain → reddito di capitale', () => {
    expect(incomeType('etf', 500)).toBe('capitale')
  })

  test('ETF loss → reddito diverso', () => {
    expect(incomeType('etf', -500)).toBe('diverse')
  })

  test('ETF zero gain → reddito diverso', () => {
    expect(incomeType('etf', 0)).toBe('diverse')
  })

  test('stock gain → reddito diverso', () => {
    expect(incomeType('stock', 1000)).toBe('diverse')
  })

  test('stock loss → reddito diverso', () => {
    expect(incomeType('stock', -1000)).toBe('diverse')
  })

  test('bond gain → reddito diverso', () => {
    expect(incomeType('bond', 200)).toBe('diverse')
  })

  test('crypto gain → reddito diverso', () => {
    expect(incomeType('crypto', 3000)).toBe('diverse')
  })

  test('other gain → reddito diverso', () => {
    expect(incomeType('other', 100)).toBe('diverse')
  })
})
