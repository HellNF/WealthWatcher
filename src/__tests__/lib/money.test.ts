// src/__tests__/lib/money.test.ts
import { toMinor, fromMinor, formatMoney, dec } from '@/lib/money'

describe('toMinor / fromMinor round-trip', () => {
  test('EUR: 12.50 → 1250 → "12.50"', () => {
    expect(toMinor('12.50', 'EUR')).toBe(1250)
    expect(fromMinor(1250, 'EUR')).toBe('12.50')
  })

  test('EUR: 0 → 0 → "0.00"', () => {
    expect(toMinor('0', 'EUR')).toBe(0)
    expect(fromMinor(0, 'EUR')).toBe('0.00')
  })

  test('JPY: no decimals (100 yen = 100 minor units)', () => {
    expect(toMinor('100', 'JPY')).toBe(100)
    expect(fromMinor(100, 'JPY')).toBe('100')
  })

  test('BTC: 8 decimal places', () => {
    expect(toMinor('0.00000001', 'BTC')).toBe(1)
    expect(fromMinor(1, 'BTC')).toBe('0.00000001')
  })

  test('large amount stays a safe integer', () => {
    // 1 billion EUR = 100_000_000_000 cents — still safe
    const minor = toMinor('1000000000', 'EUR')
    expect(minor).toBe(100_000_000_000)
    expect(Number.isSafeInteger(minor)).toBe(true)
  })
})

describe('no floating-point errors', () => {
  test('0.1 + 0.2 via minor units gives exact result', () => {
    // Native JS: 0.1 + 0.2 === 0.30000000000000004
    const a = toMinor('0.10', 'EUR')
    const b = toMinor('0.20', 'EUR')
    expect(fromMinor(a + b, 'EUR')).toBe('0.30')
  })

  test('repeated small additions stay exact', () => {
    // 100 × €0.01 should be €1.00, not a float drift
    let sum = 0
    for (let i = 0; i < 100; i++) sum += toMinor('0.01', 'EUR')
    expect(fromMinor(sum, 'EUR')).toBe('1.00')
  })
})

describe('rounding (ROUND_HALF_EVEN / banker)', () => {
  test('0.005 EUR rounds to 0 (half-even: 0 is even)', () => {
    // 0.5 cents → should round to nearest even cent (0)
    expect(toMinor('0.005', 'EUR')).toBe(0)
  })

  test('0.015 EUR rounds to 2 (half-even: 2 is even)', () => {
    expect(toMinor('0.015', 'EUR')).toBe(2)
  })
})

describe('error cases', () => {
  test('unknown currency throws', () => {
    expect(() => toMinor('1.00', 'XYZ')).toThrow('Unsupported currency: XYZ')
    expect(() => fromMinor(100, 'XYZ')).toThrow('Unsupported currency: XYZ')
  })

  test('invalid decimal string throws', () => {
    expect(() => toMinor('not-a-number', 'EUR')).toThrow()
  })
})

describe('dec() helper', () => {
  test('creates a Decimal from string', () => {
    const d = dec('1.23456789')
    expect(d.toString()).toBe('1.23456789')
  })

  test('no float drift on multiplication', () => {
    // Native: 0.1 * 0.1 = 0.010000000000000002
    expect(dec('0.1').times(dec('0.1')).toString()).toBe('0.01')
  })
})

describe('formatMoney', () => {
  test('formats EUR minor units as locale string', () => {
    // Italian locale: "1.234,56 €" — contains the digits and the € symbol
    const formatted = formatMoney(123456, 'EUR')
    expect(formatted).toContain('1')
    expect(formatted).toContain('234')
    // it-IT locale uses the € symbol, not the currency code
    expect(formatted).toMatch(/€|EUR/)
  })
})
