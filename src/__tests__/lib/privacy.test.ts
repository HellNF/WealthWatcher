// src/__tests__/lib/privacy.test.ts
import { maskIban, maskEmail, redactDescription } from '@/lib/privacy'

describe('maskIban', () => {
  test('maschera il corpo mantenendo codice paese e ultime 4 cifre', () => {
    const masked = maskIban('IT60X0542811101000000123456')
    expect(masked.startsWith('IT')).toBe(true)
    expect(masked.endsWith('3456')).toBe(true)
    expect(masked).not.toContain('0542811101000000')
  })

  test('ignora gli spazi e normalizza in maiuscolo', () => {
    const masked = maskIban('it60 x054 2811 1010 0000 0123 456')
    expect(masked.startsWith('IT')).toBe(true)
    expect(masked.endsWith('3456')).toBe(true)
  })

  test('stringhe troppo corte vengono mascherate interamente', () => {
    expect(maskIban('AB12')).toBe('••••')
  })
})

describe('maskEmail', () => {
  test('mantiene solo il primo carattere della parte locale e il dominio', () => {
    expect(maskEmail('mario.rossi@example.com')).toBe('m••••••••••@example.com')
  })

  test('email senza @ viene mascherata interamente', () => {
    expect(maskEmail('nonemail')).toBe('••••••••')
  })
})

describe('redactDescription', () => {
  test('lascia invariati i testi entro il limite', () => {
    expect(redactDescription('Spesa')).toBe('Spesa')
  })

  test('tronca i testi più lunghi del limite con ellissi', () => {
    expect(redactDescription('Bonifico a favore di Mario Rossi', 12)).toBe('Bonifico a f…')
  })
})
