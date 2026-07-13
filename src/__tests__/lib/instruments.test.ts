// src/__tests__/lib/instruments.test.ts
import { sqlite } from '@/db'
import { getOrCreateInstrument, getInstrument, updateInstrumentKidFields } from '@/lib/instruments'

beforeEach(() => {
  sqlite.exec('DELETE FROM instruments')
})

test('getOrCreateInstrument crea uno strumento nuovo', () => {
  const instr = getOrCreateInstrument({ symbol: 'vwce', name: 'Vanguard FTSE All-World', cluster: 'etf', currency: 'eur' })
  expect(instr.symbol).toBe('VWCE')
  expect(instr.currency).toBe('EUR')
})

describe('updateInstrumentKidFields — scrive solo i campi ancora NULL', () => {
  test('valorizza un campo KID vuoto', () => {
    const instr = getOrCreateInstrument({ symbol: 'AAA', name: 'Test ETF', cluster: 'etf', currency: 'EUR' })
    expect(instr.ter).toBeNull()

    updateInstrumentKidFields(instr.id, { ter: '0.20' })
    expect(getInstrument(instr.id)?.ter).toBe('0.20')
  })

  test('NON sovrascrive un campo già valorizzato da un utente precedente', () => {
    const instr = getOrCreateInstrument({ symbol: 'BBB', name: 'Test ETF 2', cluster: 'etf', currency: 'EUR' })

    // Primo utente conferma il KID.
    updateInstrumentKidFields(instr.id, { ter: '0.20', sri: 4 })
    expect(getInstrument(instr.id)).toMatchObject({ ter: '0.20', sri: 4 })

    // Un secondo utente (magari malevolo o solo impreciso) tenta di
    // sovrascrivere con valori diversi: il dato già confermato resta intatto.
    updateInstrumentKidFields(instr.id, { ter: '9.99', sri: 7 })
    expect(getInstrument(instr.id)).toMatchObject({ ter: '0.20', sri: 4 })
  })

  test('campi diversi vengono comunque valorizzati indipendentemente', () => {
    const instr = getOrCreateInstrument({ symbol: 'CCC', name: 'Test ETF 3', cluster: 'etf', currency: 'EUR' })

    updateInstrumentKidFields(instr.id, { ter: '0.15' })
    updateInstrumentKidFields(instr.id, { ter: '0.99', entry_cost: '1.00' }) // ter ignorato, entry_cost applicato

    expect(getInstrument(instr.id)).toMatchObject({ ter: '0.15', entry_cost: '1.00' })
  })

  test('name resta quello impostato alla creazione (non sovrascrivibile via KID)', () => {
    const instr = getOrCreateInstrument({ symbol: 'DDD', name: 'Nome Originale', cluster: 'etf', currency: 'EUR' })
    updateInstrumentKidFields(instr.id, { name: 'Nome Alterato Da Altro Utente' })
    expect(getInstrument(instr.id)?.name).toBe('Nome Originale')
  })
})
