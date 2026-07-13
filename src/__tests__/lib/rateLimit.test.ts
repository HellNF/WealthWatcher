// src/__tests__/lib/rateLimit.test.ts
import { checkRateLimit, _resetRateLimitsForTests } from '@/lib/rateLimit'

beforeEach(() => {
  _resetRateLimitsForTests()
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2026-01-01T00:00:00Z'))
})

afterEach(() => {
  jest.useRealTimers()
})

test('consente le chiamate entro il limite', () => {
  expect(checkRateLimit('k', 3, 1000).allowed).toBe(true)
  expect(checkRateLimit('k', 3, 1000).allowed).toBe(true)
  expect(checkRateLimit('k', 3, 1000).allowed).toBe(true)
})

test('rifiuta la chiamata oltre il limite nella stessa finestra', () => {
  checkRateLimit('k', 2, 1000)
  checkRateLimit('k', 2, 1000)
  const result = checkRateLimit('k', 2, 1000)
  expect(result.allowed).toBe(false)
  expect(result.retryAfterMs).toBeGreaterThan(0)
})

test('chiavi diverse hanno bucket indipendenti', () => {
  checkRateLimit('a', 1, 1000)
  expect(checkRateLimit('a', 1, 1000).allowed).toBe(false)
  expect(checkRateLimit('b', 1, 1000).allowed).toBe(true)
})

test('la finestra si resetta trascorso windowMs', () => {
  checkRateLimit('k', 1, 1000)
  expect(checkRateLimit('k', 1, 1000).allowed).toBe(false)

  jest.advanceTimersByTime(1001)
  expect(checkRateLimit('k', 1, 1000).allowed).toBe(true)
})

test('remaining decresce ad ogni chiamata consentita', () => {
  expect(checkRateLimit('k', 3, 1000).remaining).toBe(2)
  expect(checkRateLimit('k', 3, 1000).remaining).toBe(1)
  expect(checkRateLimit('k', 3, 1000).remaining).toBe(0)
})
