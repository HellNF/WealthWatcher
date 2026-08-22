// src/__tests__/lib/merchants.test.ts — resolveIntesaCategory / resolveMccCategory:
// mappature "codice esterno → categoria WealthWatcher" usate come fallback
// quando nessuna regola utente/alias merchant fa match. Usa le categorie
// seedate (src/db/seed.ts), reali nel DB di test.
import { resolveIntesaCategory, resolveMccCategory, resolveBankTransactionCategory } from '@/lib/merchants'
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

  test('7011 (hotel) → Viaggi', () => {
    expect(categoryName(resolveMccCategory('7011'))).toBe('Viaggi')
  })

  test('5200 (materiali edili) → Casa', () => {
    expect(categoryName(resolveMccCategory('5200'))).toBe('Casa')
  })

  test('7230 (parrucchieri) → Cura personale', () => {
    expect(categoryName(resolveMccCategory('7230'))).toBe('Cura personale')
  })

  test('6300 (assicurazioni) → Assicurazioni', () => {
    expect(categoryName(resolveMccCategory('6300'))).toBe('Assicurazioni')
  })

  describe('range', () => {
    test('3100 (dentro il range compagnie aeree 3000-3299) → Viaggi', () => {
      expect(categoryName(resolveMccCategory('3100'))).toBe('Viaggi')
    })

    test('3299 (estremo superiore del range compagnie aeree) → Viaggi', () => {
      expect(categoryName(resolveMccCategory('3299'))).toBe('Viaggi')
    })

    test('3300 (appena fuori dal range) → null', () => {
      expect(resolveMccCategory('3300')).toBeNull()
    })

    test('3400 (dentro il range autonoleggi 3351-3500) → Trasporti', () => {
      expect(categoryName(resolveMccCategory('3400'))).toBe('Trasporti')
    })

    test('3700 (dentro il range catene alberghiere 3501-3999) → Viaggi', () => {
      expect(categoryName(resolveMccCategory('3700'))).toBe('Viaggi')
    })
  })
})

describe('resolveBankTransactionCategory', () => {
  test('SALA (accredito stipendio) → Stipendio', () => {
    expect(categoryName(resolveBankTransactionCategory(undefined, 'SALA'))).toBe('Stipendio')
  })

  test('PENS (pensione) → Previdenza', () => {
    expect(categoryName(resolveBankTransactionCategory(undefined, 'PENS'))).toBe('Previdenza')
  })

  test('TAXS (tributi) → Tasse', () => {
    expect(categoryName(resolveBankTransactionCategory(undefined, 'TAXS'))).toBe('Tasse')
  })

  test('CWDL (prelievo contante) → Trasferimento', () => {
    expect(categoryName(resolveBankTransactionCategory(undefined, 'CWDL'))).toBe('Trasferimento')
  })

  test('minuscolo → normalizzato comunque', () => {
    expect(categoryName(resolveBankTransactionCategory(undefined, 'sala'))).toBe('Stipendio')
  })

  test('ESCT (bonifico generico) → null, deliberatamente non mappato', () => {
    expect(resolveBankTransactionCategory('PMNT', 'ESCT')).toBeNull()
  })

  test('ESDD (addebito SEPA) → null, deliberatamente non mappato', () => {
    expect(resolveBankTransactionCategory('PMNT', 'ESDD')).toBeNull()
  })

  test('sub-code proprietario ignoto → null', () => {
    expect(resolveBankTransactionCategory('PMNT', 'XYZQ')).toBeNull()
  })

  test('undefined/null → null (nessun crash)', () => {
    expect(resolveBankTransactionCategory(undefined, undefined)).toBeNull()
    expect(resolveBankTransactionCategory(null, null)).toBeNull()
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
