// src/__tests__/lib/merchants.test.ts — resolveIntesaCategory / resolveMccCategory:
// mappature "codice esterno → categoria WealthWatcher" usate come fallback
// quando nessuna regola utente/alias merchant fa match. Usa le categorie
// seedate (src/db/seed.ts), reali nel DB di test.
import { resolveIntesaCategory, resolveMccCategory } from '@/lib/merchants'
import { sqlite } from '@/db'

function categoryName(id: number | null): string | null {
  if (id === null) return null
  const row = sqlite.prepare('SELECT name FROM categories WHERE id = ?').get(id) as { name: string } | undefined
  return row?.name ?? null
}

describe('resolveMccCategory', () => {
  test('5411 (supermercati) → Supermercato', () => {
    expect(categoryName(resolveMccCategory('5411'))).toBe('Supermercato')
  })

  test('5812 (ristoranti) → Ristorante & Bar', () => {
    expect(categoryName(resolveMccCategory('5812'))).toBe('Ristorante & Bar')
  })

  test('5541 (stazioni di servizio) → Carburante', () => {
    expect(categoryName(resolveMccCategory('5541'))).toBe('Carburante')
  })

  test('8062 (ospedali) → Salute', () => {
    expect(categoryName(resolveMccCategory('8062'))).toBe('Salute')
  })

  test('codice sconosciuto → null', () => {
    expect(resolveMccCategory('0000')).toBeNull()
  })

  test('undefined/null/stringa vuota → null (nessun crash)', () => {
    expect(resolveMccCategory(undefined)).toBeNull()
    expect(resolveMccCategory(null)).toBeNull()
    expect(resolveMccCategory('')).toBeNull()
  })

  test('ignora spazi bianchi attorno al codice', () => {
    expect(categoryName(resolveMccCategory(' 5411 '))).toBe('Supermercato')
  })
})

describe('resolveIntesaCategory', () => {
  test('categoria nota → id categoria corrispondente', () => {
    expect(categoryName(resolveIntesaCategory('Generi alimentari e supermercato'))).toBe('Supermercato')
  })

  test('categoria sconosciuta → null', () => {
    expect(resolveIntesaCategory('Categoria inventata')).toBeNull()
  })
})
