// src/__tests__/lib/bbva.test.ts — Parser BBVA + dispatch provider.
import * as XLSX from 'xlsx'
import { parseBbvaXlsx } from '@/lib/import/bbva'
import { providerParser, getProvider } from '@/lib/providers'
import { PARSERS } from '@/lib/import/registry'

// Costruisce un buffer XLSX in formato BBVA (preambolo + header riga 4 + dati).
function makeBbvaBuffer(dataRows: unknown[][]): Buffer {
  const preamble: unknown[][] = [
    ['', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['', '', 'Movimenti', '', '', '', ''],
    ['', '', 'Data di generazione del rapporto: 02/07/2026', '', '', '', ''],
  ]
  const header = ['', 'Data valuta', 'Data', 'Causale', 'Movimento', 'Beneficiario', 'Importo']
  const ws = XLSX.utils.aoa_to_sheet([...preamble, header, ...dataRows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Informe BBVA')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

describe('parseBbvaXlsx', () => {
  test('interpreta una transazione (uscita)', () => {
    const buf = makeBbvaBuffer([
      ['', '29/06/2026', '29/06/2026', 'IPERFUEL SRL LA VALLE', 'PAGAMENTO CON CARTA', '-\n-', '-30.04 EUR'],
    ])
    const rows = parseBbvaXlsx(buf)
    expect(rows).toHaveLength(1)
    const r = rows[0]
    expect(r.bookedDate).toBe('2026-06-29')
    expect(r.valueDate).toBe('2026-06-29')
    expect(r.amountMinor).toBe(-3004)
    expect(r.currency).toBe('EUR')
    expect(r.descriptionRaw).toBe('IPERFUEL SRL LA VALLE')
    expect(r.intesaCategory).toBe('')
    expect(r.dedupHash).toHaveLength(64)
  })

  test('importi: interi, decimali e segno positivo', () => {
    const buf = makeBbvaBuffer([
      ['', '17/04/2026', '17/04/2026', 'BONIFICO RICEVUTO', 'Giroconto', 'Mario Rossi\nIT05...', '450 EUR'],
      ['', '01/06/2026', '02/06/2026', 'LIQUIDAZIONE INTERESSI', '', '-\n-', '1.46 EUR'],
      ['', '18/06/2026', '18/06/2026', 'PAYPAL *GFM', 'PAGAMENTO CON CARTA', '-\n-', '-50 EUR'],
    ])
    const rows = parseBbvaXlsx(buf)
    expect(rows.map((r) => r.amountMinor)).toEqual([45000, 146, -5000])
    // Beneficiario valorizzato → controparte; placeholder "-\n-" → usa il Movimento
    expect(rows[0].counterpartyRaw).toBe('Mario Rossi IT05...')
    expect(rows[2].counterpartyRaw).toBe('PAGAMENTO CON CARTA')
  })

  test('date gg/mm/aaaa → ISO; value date può differire dalla booking date', () => {
    const buf = makeBbvaBuffer([
      ['', '04/06/2026', '08/06/2026', 'TPER SPA', 'PAGAMENTO CON CARTA', '-\n-', '-2.1 EUR'],
    ])
    const [r] = parseBbvaXlsx(buf)
    expect(r.valueDate).toBe('2026-06-04')
    expect(r.bookedDate).toBe('2026-06-08')
    expect(r.amountMinor).toBe(-210)
  })

  test('duplicati legittimi → hash distinti (indice occorrenza)', () => {
    const dup = ['', '29/04/2026', '04/05/2026', 'PAGOPA-NEXI', 'PAGAMENTO CON CARTA', '-\n-', '-4.28 EUR']
    const rows = parseBbvaXlsx(makeBbvaBuffer([dup, [...dup]]))
    expect(rows).toHaveLength(2)
    expect(rows[0].dedupHash).not.toBe(rows[1].dedupHash)
  })

  test('formato non riconosciuto → errore chiaro', () => {
    const ws = XLSX.utils.aoa_to_sheet([['a', 'b'], ['c', 'd']])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'X')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    expect(() => parseBbvaXlsx(buf)).toThrow('Formato BBVA non riconosciuto')
  })
})

describe('provider dispatch', () => {
  test('provider con parser risolvono la funzione corretta', () => {
    expect(providerParser('intesa')).toBe('intesa_xlsx')
    expect(providerParser('bbva')).toBe('bbva_xlsx')
    expect(typeof PARSERS[providerParser('bbva')!]).toBe('function')
  })

  test('provider senza parser e custom → null', () => {
    expect(providerParser('paypal')).toBeNull()
    expect(providerParser('n26')).toBeNull()
    expect(providerParser(null)).toBeNull()
    expect(providerParser('inesistente')).toBeNull()
  })

  test('revolut ha parser csv', () => {
    expect(providerParser('revolut')).toBe('revolut_csv')
    expect(typeof PARSERS[providerParser('revolut')!]).toBe('function')
  })

  test('getProvider ritorna nome e kind di default', () => {
    expect(getProvider('bbva')?.name).toBe('BBVA')
    expect(getProvider('trade_republic')?.defaultKind).toBe('both')
  })
})
