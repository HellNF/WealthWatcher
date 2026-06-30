// FX module tests — Frankfurter is mocked at module level.
// Uses dynamic imports (like prices.test.ts) to avoid jest.mock hoisting / TDZ issues.
jest.mock('@/lib/fx/frankfurter')

import { sqlite } from '@/db'
import { fetchRates } from '@/lib/fx/frankfurter'

const mockFetchRates = fetchRates as jest.Mock

// ── Test DB setup ─────────────────────────────────────────────────────────────

beforeAll(() => {
  sqlite.exec(`DELETE FROM fx_history`)
})

afterAll(() => {
  sqlite.exec(`DELETE FROM fx_history`)
})

afterEach(() => {
  jest.clearAllMocks()
})

// ── getRate ───────────────────────────────────────────────────────────────────

describe('getRate', () => {
  test('EUR → EUR returns "1" without fetching', async () => {
    const { getRate } = await import('@/lib/fx/rates')
    const rate = await getRate('2024-01-15', 'EUR')
    expect(rate).toBe('1')
    expect(mockFetchRates).not.toHaveBeenCalled()
  })

  test('cache miss → fetches and stores, returns rate', async () => {
    const { getRate } = await import('@/lib/fx/rates')
    mockFetchRates.mockResolvedValue({ USD: 1.08, GBP: 0.85 })
    const rate = await getRate('2024-01-15', 'USD')
    expect(rate).toBe('1.08')
    expect(mockFetchRates).toHaveBeenCalledTimes(1)
  })

  test('cache hit → no second fetch', async () => {
    const { getRate } = await import('@/lib/fx/rates')
    const rate = await getRate('2024-01-15', 'USD')
    expect(rate).toBe('1.08')
    expect(mockFetchRates).not.toHaveBeenCalled()
  })

  test('GBP also cached from same fetch', async () => {
    const { getRate } = await import('@/lib/fx/rates')
    const rate = await getRate('2024-01-15', 'GBP')
    expect(rate).toBe('0.85')
    expect(mockFetchRates).not.toHaveBeenCalled()
  })

  test('source down → returns null', async () => {
    const { getRate } = await import('@/lib/fx/rates')
    mockFetchRates.mockResolvedValue(null)
    const rate = await getRate('2030-01-01', 'USD')
    expect(rate).toBeNull()
  })

  test('unknown currency → returns null', async () => {
    const { getRate } = await import('@/lib/fx/rates')
    mockFetchRates.mockResolvedValue({ USD: 1.08 })
    const rate = await getRate('2024-01-16', 'XYZ')
    expect(rate).toBeNull()
  })
})

// ── refreshFxRates ────────────────────────────────────────────────────────────

describe('refreshFxRates', () => {
  test('pre-populates all fiat currencies for a date', async () => {
    const { getRate, refreshFxRates } = await import('@/lib/fx/rates')
    sqlite.exec(`DELETE FROM fx_history WHERE date = '2024-02-01'`)
    mockFetchRates.mockResolvedValue({ USD: 1.09, GBP: 0.86, CHF: 0.94, SEK: 11.2, NOK: 11.5, DKK: 7.46, JPY: 161 })
    await refreshFxRates('2024-02-01')
    // All fiat currencies should now be in cache — verify JPY
    mockFetchRates.mockClear()
    const rate = await getRate('2024-02-01', 'JPY')
    expect(rate).toBe('161')
    expect(mockFetchRates).not.toHaveBeenCalled()
  })
})

// ── convertToEur ──────────────────────────────────────────────────────────────

describe('convertToEur', () => {
  test('EUR → EUR is identity', async () => {
    const { convertToEur } = await import('@/lib/fx/convert')
    const result = await convertToEur(150_00, 'EUR', '2024-01-15')
    expect(result).toBe(150_00)
  })

  test('USD → EUR (1 EUR = 1.08 USD, so 108 USD = 100 EUR)', async () => {
    const { convertToEur } = await import('@/lib/fx/convert')
    // Uses cached rate from getRate tests above (2024-01-15, USD=1.08)
    const result = await convertToEur(10800, 'USD', '2024-01-15')
    expect(result).toBe(10000)
  })

  test('JPY → EUR (cross-decimals: JPY 0dp → EUR 2dp)', async () => {
    const { convertToEur } = await import('@/lib/fx/convert')
    // 1 EUR = 161 JPY; 161 JPY minor (JPY has 0dp) → 1 EUR → 100 EUR minor
    // Uses cached rate from refreshFxRates test (2024-02-01, JPY=161)
    const result = await convertToEur(161, 'JPY', '2024-02-01')
    expect(result).toBe(100)
  })

  test('returns null if rate unavailable', async () => {
    const { convertToEur } = await import('@/lib/fx/convert')
    mockFetchRates.mockResolvedValue(null)
    const result = await convertToEur(10000, 'USD', '2030-12-31')
    expect(result).toBeNull()
  })
})
