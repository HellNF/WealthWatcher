// src/__tests__/lib/spec.test.ts
import { readSpec } from '@/lib/spec'

test('readSpec restituisce html e headings', () => {
  const { html, headings } = readSpec()
  expect(typeof html).toBe('string')
  expect(html.length).toBeGreaterThan(0)
  expect(Array.isArray(headings)).toBe(true)
})

test('readSpec estrae heading H1 come primo elemento', () => {
  const { headings } = readSpec()
  expect(headings[0].level).toBe(1)
  expect(headings[0].id).toBeTruthy()
})

test('readSpec genera id slug validi senza caratteri speciali', () => {
  const { headings } = readSpec()
  for (const h of headings) {
    expect(h.id).toMatch(/^[a-z0-9-]+$/)
  }
})
