// src/__tests__/lib/redirect.test.ts
import { isSafeRedirectPath } from '@/lib/security/redirect'

test('accetta un path interno', () => {
  expect(isSafeRedirectPath('/dashboard')).toBe(true)
  expect(isSafeRedirectPath('/dashboard/reports?month=2026-06')).toBe(true)
})

test('rifiuta un URL protocol-relative ("//evil.com")', () => {
  expect(isSafeRedirectPath('//evil.com')).toBe(false)
  expect(isSafeRedirectPath('//evil.com/dashboard')).toBe(false)
})

test('rifiuta un path con backslash iniziale ("/\\evil.com")', () => {
  expect(isSafeRedirectPath('/\\evil.com')).toBe(false)
})

test('rifiuta un URL assoluto con schema', () => {
  expect(isSafeRedirectPath('https://evil.com')).toBe(false)
  expect(isSafeRedirectPath('javascript:alert(1)')).toBe(false)
})

test('rifiuta una stringa vuota', () => {
  expect(isSafeRedirectPath('')).toBe(false)
})
