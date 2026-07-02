// src/__tests__/lib/import.test.ts — Parser + dedup + merchant resolution tests.
import * as XLSX from 'xlsx'
import { parseIntesaXlsx, type ParsedRow } from '@/lib/import/intesa'
import { normalizeDescription, resolveMerchant, resolveIntesaCategory } from '@/lib/merchants'
import { fromMinor } from '@/lib/money'
import { sqlite } from '@/db'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeXlsxBuffer(dataRows: unknown[][]): Buffer {
  const wb = XLSX.utils.book_new()
  // Preamble rows (rows 0–17 in real Intesa format)
  const preamble: unknown[][] = Array(18).fill(null).map((_, i) => {
    if (i === 0) return ['', '', '', '', '', '', '', '', 'PF', '', '']
    return Array(11).fill('')
  })
  // Header row (row 18)
  const header = ['Data', 'Operazione', 'Dettagli', 'Conto o carta', 'Contabilizzazione', 'Categoria ', 'Valuta', 'Importo', '', '', '']
  const allRows = [...preamble, header, ...dataRows]
  const ws = XLSX.utils.aoa_to_sheet(allRows)
  XLSX.utils.book_append_sheet(wb, ws, 'Lista Operazione')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return buf
}

// Excel serial: epoch is Dec 30 1899; 46188 = 2026-06-15
const DATE_15_JUNE = 46188
const DATE_16_JUNE = 46189
const DATE_17_JUNE = 46190

describe('parseIntesaXlsx — basic parsing', () => {
  test('parses a single transaction correctly', () => {
    const buf = makeXlsxBuffer([
      [DATE_15_JUNE, 'Netflix', 'NETFLIX.COM 15/060000', 'Conto 1000/00001234', 'SI', 'Abbonamenti', 'EUR', -15.99, '', '', ''],
    ])
    const rows = parseIntesaXlsx(buf)
    expect(rows).toHaveLength(1)
    const r = rows[0]
    expect(r.bookedDate).toBe('2026-06-15')
    expect(r.amountMinor).toBe(-1599)
    expect(r.currency).toBe('EUR')
    expect(r.descriptionRaw).toBe('Netflix')
    expect(r.counterpartyRaw).toBe('NETFLIX.COM 15/060000')
    expect(r.intesaCategory).toBe('Abbonamenti')
    expect(r.dedupHash).toHaveLength(64) // sha256 hex
  })

  test('parses positive amount (income) correctly', () => {
    const buf = makeXlsxBuffer([
      [DATE_16_JUNE, 'Bonifico in entrata', 'Da Tizio Caio', 'Conto 1000/00001234', 'SI', 'Entrate varie', 'EUR', 1500, '', '', ''],
    ])
    const rows = parseIntesaXlsx(buf)
    expect(rows[0].amountMinor).toBe(150000)
  })

  test('skips blank/metadata rows after data', () => {
    const buf = makeXlsxBuffer([
      [DATE_15_JUNE, 'Esselunga', 'ESSELUNGA SPA 15/060930', 'Conto', 'SI', 'Generi alimentari', 'EUR', -12.50, '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', ''], // blank row
      ['', '', '', '', '', '', '', '', '', '', ''],
    ])
    expect(parseIntesaXlsx(buf)).toHaveLength(1)
  })

  test('throws on missing header row', () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([['Unexpected', 'format'], [1, 2]])
    XLSX.utils.book_append_sheet(wb, ws, 'Lista Operazione')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    expect(() => parseIntesaXlsx(buf)).toThrow('Formato Intesa non riconosciuto')
  })
})

describe('parseIntesaXlsx — amount rounding', () => {
  test('converts 2-decimal float to exact minor units', () => {
    const buf = makeXlsxBuffer([
      [DATE_15_JUNE, 'Coop', 'COOP 15/060000', 'Conto', 'SI', 'Supermercato', 'EUR', -4.59, '', '', ''],
    ])
    const [r] = parseIntesaXlsx(buf)
    expect(r.amountMinor).toBe(-459)
    expect(fromMinor(r.amountMinor, 'EUR')).toBe('-4.59')
  })

  test('integer amounts (no decimals)', () => {
    const buf = makeXlsxBuffer([
      [DATE_15_JUNE, 'Amazon', 'Amazon.it', 'Conto', 'SI', 'Addebiti vari', 'EUR', -1599, '', '', ''],
    ])
    expect(parseIntesaXlsx(buf)[0].amountMinor).toBe(-159900)
  })
})

describe('parseIntesaXlsx — dedup hashing', () => {
  test('same row twice gets different hashes (occurrence index)', () => {
    const row = [DATE_15_JUNE, 'Coop', 'N.D', 'Conto', 'SI', 'Supermercato', 'EUR', -4.59, '', '', '']
    const buf = makeXlsxBuffer([row, row])
    const rows = parseIntesaXlsx(buf)
    expect(rows).toHaveLength(2)
    expect(rows[0].dedupHash).not.toBe(rows[1].dedupHash)
  })

  test('different rows get different hashes', () => {
    const buf = makeXlsxBuffer([
      [DATE_15_JUNE, 'Coop',     'COOP A 15/06', 'Conto', 'SI', 'Supermercato', 'EUR', -4.59, '', '', ''],
      [DATE_16_JUNE, 'Esselunga','ESSELUNGA 16/06','Conto','SI', 'Supermercato', 'EUR', -4.59, '', '', ''],
    ])
    const rows = parseIntesaXlsx(buf)
    expect(rows[0].dedupHash).not.toBe(rows[1].dedupHash)
  })

  test('re-parsing same file produces identical hashes (idempotent)', () => {
    const row1 = [DATE_15_JUNE, 'Coop', 'N.D', 'Conto', 'SI', 'Supermercato', 'EUR', -4.59, '', '', '']
    const row2 = [DATE_15_JUNE, 'Coop', 'N.D', 'Conto', 'SI', 'Supermercato', 'EUR', -4.59, '', '', '']
    const buf = makeXlsxBuffer([row1, row2])
    const first  = parseIntesaXlsx(buf).map((r) => r.dedupHash)
    const second = parseIntesaXlsx(buf).map((r) => r.dedupHash)
    expect(first).toEqual(second)
  })
})

describe('normalizeDescription', () => {
  test('strips date/time codes', () => {
    expect(normalizeDescription('COOP 200051 VIA BRIGATA A25/060944')).not.toContain('25/060944')
  })

  test('strips ABI codes', () => {
    expect(normalizeDescription('COOP VIA BRIGATA ABI 09517 COD.3010905/000815')).not.toContain('abi')
    expect(normalizeDescription('COOP VIA BRIGATA ABI 09517 COD.3010905/000815')).not.toContain('cod.')
  })

  test('lowercases the result', () => {
    const result = normalizeDescription('NETFLIX.COM 15/060000')
    expect(result).toBe(result.toLowerCase())
  })

  test('collapses multiple spaces', () => {
    const result = normalizeDescription('foo   bar')
    expect(result).toBe('foo bar')
  })
})

describe('resolveMerchant — alias matching', () => {
  // Seed data is available in :memory: DB via runSeed()

  test('matches "netflix" alias', () => {
    const match = resolveMerchant('netflix.com 15/060000')
    expect(match).not.toBeNull()
    expect(match?.merchantId).toBeGreaterThan(0)
    expect(match?.categoryId).toBeGreaterThan(0) // Abbonamenti
  })

  test('matches "esselunga" alias', () => {
    const match = resolveMerchant('esselunga spa via roma')
    expect(match).not.toBeNull()
  })

  test('matches "coop" alias', () => {
    const match = resolveMerchant('coop 200051 via brigata')
    expect(match).not.toBeNull()
  })

  test('returns null for unknown merchant', () => {
    const match = resolveMerchant('pizzeria da mario trattoria')
    expect(match).toBeNull()
  })
})

describe('resolveIntesaCategory — fallback mapping', () => {
  test('maps "Generi alimentari e supermercato" → Supermercato id', () => {
    const id = resolveIntesaCategory('Generi alimentari e supermercato')
    expect(id).not.toBeNull()
    expect(id).toBeGreaterThan(0)
  })

  test('maps "Treno, aereo, nave" → Trasporti id', () => {
    const id = resolveIntesaCategory('Treno, aereo, nave')
    expect(id).not.toBeNull()
  })

  test('returns null for unmapped Intesa category', () => {
    expect(resolveIntesaCategory('Categoria sconosciuta XYZ')).toBeNull()
  })
})

describe('full import pipeline — dedup idempotency', () => {
  // Use the real :memory: DB. Clean up transactions + batches between tests.
  let accountId: number
  let ownerId: number

  beforeAll(() => {
    // Create a user + institution + bank account for these tests
    sqlite.exec(`
      INSERT OR IGNORE INTO allowed_emails (email, role) VALUES ('import_test@example.com','member');
      INSERT OR IGNORE INTO users (email, role) VALUES ('import_test@example.com','member');
    `)
    const user = sqlite.prepare("SELECT id FROM users WHERE email='import_test@example.com'").get() as { id: number }
    ownerId = user.id

    sqlite.prepare(`
      INSERT INTO institutions (owner_id, name, kind) VALUES (?, 'Intesa Test', 'bank')
    `).run(ownerId)
    const inst = sqlite.prepare('SELECT id FROM institutions WHERE owner_id = ? LIMIT 1').get(ownerId) as { id: number }

    sqlite.prepare(`
      INSERT INTO bank_accounts (institution_id, owner_id, name, currency) VALUES (?, ?, 'Conto test', 'EUR')
    `).run(inst.id, ownerId)
    const acc = sqlite.prepare('SELECT id FROM bank_accounts WHERE owner_id = ? LIMIT 1').get(ownerId) as { id: number }
    accountId = acc.id
  })

  afterEach(() => {
    sqlite.exec('DELETE FROM transactions WHERE owner_id = ?'.replace('?', String(ownerId)))
    sqlite.exec('DELETE FROM import_batches WHERE owner_id = ?'.replace('?', String(ownerId)))
  })

  test('importing the same file twice inserts 0 rows on second import', () => {
    const { insertBatch } = require('@/lib/transactions')
    const { previewRows } = require('@/lib/transactions')

    const rows = [
      {
        owner_id: ownerId, bank_account_id: accountId,
        booked_date: '2026-06-15', amount_minor: -459, currency: 'EUR',
        description_raw: 'Coop', dedup_hash: 'hash_unique_1',
      },
      {
        owner_id: ownerId, bank_account_id: accountId,
        booked_date: '2026-06-16', amount_minor: -1599, currency: 'EUR',
        description_raw: 'Netflix', dedup_hash: 'hash_unique_2',
      },
    ]

    const r1 = insertBatch({ ownerId, bankAccountId: accountId, source: 'test', filename: 'a.xlsx', rows })
    expect(r1.insertedCount).toBe(2)
    expect(r1.duplicateCount).toBe(0)

    const r2 = insertBatch({ ownerId, bankAccountId: accountId, source: 'test', filename: 'a.xlsx', rows })
    expect(r2.insertedCount).toBe(0)
    expect(r2.duplicateCount).toBe(2)
  })

  test('previewRows classifies correctly after first import', () => {
    const { insertBatch, previewRows } = require('@/lib/transactions')

    const rows = [{
      owner_id: ownerId, bank_account_id: accountId,
      booked_date: '2026-06-15', amount_minor: -459, currency: 'EUR',
      description_raw: 'Coop', dedup_hash: 'hash_coop_preview',
    }]

    insertBatch({ ownerId, bankAccountId: accountId, source: 'test', filename: 'b.xlsx', rows })

    const preview = previewRows(accountId, rows)
    expect(preview[0].status).toBe('duplicate')
  })
})
