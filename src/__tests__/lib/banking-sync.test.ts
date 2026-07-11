// src/__tests__/lib/banking-sync.test.ts — Mapping EbTransaction →
// InsertableTransaction: segno dell'importo, dedup idempotente su
// entry_reference, fallback a occorrenza in-batch quando assente.
import { mapTransactions } from '@/lib/banking/sync'
import type { EbTransaction } from '@/lib/banking/types'
import { sqlite } from '@/db'

function categoryName(id: number | null): string | null {
  if (id === null) return null
  const row = sqlite.prepare('SELECT name FROM categories WHERE id = ?').get(id) as { name: string } | undefined
  return row?.name ?? null
}

describe('mapTransactions', () => {
  test('DBIT → importo negativo, CRDT → importo positivo', () => {
    const rows: EbTransaction[] = [
      {
        entry_reference:  'ref-1',
        booking_date:     '2026-07-01',
        transaction_amount: { amount: '12.50', currency: 'EUR' },
        credit_debit_indicator: 'DBIT',
        remittance_information: ['Supermercato'],
      },
      {
        entry_reference:  'ref-2',
        booking_date:     '2026-07-02',
        transaction_amount: { amount: '1000.00', currency: 'EUR' },
        credit_debit_indicator: 'CRDT',
        remittance_information: ['Stipendio'],
      },
    ]
    const mapped = mapTransactions(1, 42, rows)
    expect(mapped[0].amount_minor).toBe(-1250)
    expect(mapped[1].amount_minor).toBe(100_000)
  })

  test('dedup_hash deterministico su entry_reference → sync ripetuti idempotenti', () => {
    const row: EbTransaction = {
      entry_reference: 'stable-ref',
      booking_date:    '2026-07-01',
      transaction_amount: { amount: '5.00', currency: 'EUR' },
      credit_debit_indicator: 'DBIT',
    }
    const first  = mapTransactions(1, 42, [row])
    const second = mapTransactions(1, 42, [row])
    expect(first[0].dedup_hash).toBe(second[0].dedup_hash)
    expect(first[0].external_id).toBe('stable-ref')
  })

  test('senza entry_reference, righe identiche ottengono hash distinti (occorrenza in-batch)', () => {
    const row: EbTransaction = {
      booking_date:    '2026-07-01',
      transaction_amount: { amount: '4.59', currency: 'EUR' },
      credit_debit_indicator: 'DBIT',
      remittance_information: ['Coop'],
    }
    const mapped = mapTransactions(1, 42, [row, { ...row }])
    expect(mapped).toHaveLength(2)
    expect(mapped[0].dedup_hash).not.toBe(mapped[1].dedup_hash)
    expect(mapped[0].external_id).toBeNull()
  })

  test('transazione senza booking_date né value_date viene scartata', () => {
    const row = {
      transaction_amount: { amount: '1.00', currency: 'EUR' },
      credit_debit_indicator: 'DBIT',
    } as EbTransaction
    const mapped = mapTransactions(1, 42, [row])
    expect(mapped).toHaveLength(0)
  })

  test('usa value_date come booked_date se manca booking_date', () => {
    const row: EbTransaction = {
      entry_reference: 'ref-vd',
      value_date:      '2026-07-05',
      transaction_amount: { amount: '2.00', currency: 'EUR' },
      credit_debit_indicator: 'CRDT',
    }
    const mapped = mapTransactions(1, 42, [row])
    expect(mapped[0].booked_date).toBe('2026-07-05')
  })
})

// ── Categorizzazione: regola utente → alias merchant → MCC ────────────────
// Le transazioni Open Banking non hanno una categoria proprietaria come gli
// export bancari (Intesa ecc.): l'unico segnale "dalla banca" è l'MCC
// (merchant_category_code), quando l'ASPSP lo fornisce. Verifica che la
// stessa pipeline di priorità dell'import manuale si applichi anche qui.
describe('mapTransactions — categorizzazione', () => {
  let userId: number

  beforeAll(() => {
    sqlite.prepare(`INSERT INTO users (email, name, role) VALUES ('banking-cat-test@example.com', 'Test', 'member')`).run()
    const u = sqlite.prepare(`SELECT id FROM users WHERE email = 'banking-cat-test@example.com'`).get() as { id: number }
    userId = u.id
  })

  afterAll(() => {
    sqlite.prepare(`DELETE FROM category_rules WHERE owner_id = ?`).run(userId)
    sqlite.prepare(`DELETE FROM users WHERE id = ?`).run(userId)
  })

  test('MCC usato come fallback quando nessuna regola/alias fa match', () => {
    const row: EbTransaction = {
      entry_reference: 'mcc-ref-1',
      booking_date:    '2026-07-01',
      transaction_amount: { amount: '35.00', currency: 'EUR' },
      credit_debit_indicator: 'DBIT',
      remittance_information: ['POS ACQUISTO SCONOSCIUTO XYZ'],
      merchant_category_code: '5812', // ristoranti
    }
    const mapped = mapTransactions(userId, 42, [row])
    expect(categoryName(mapped[0].category_id)).toBe('Ristorante & Bar')
  })

  test('alias merchant seedato vince sull\'MCC in conflitto', () => {
    const row: EbTransaction = {
      entry_reference: 'mcc-ref-2',
      booking_date:    '2026-07-01',
      transaction_amount: { amount: '12.99', currency: 'EUR' },
      credit_debit_indicator: 'DBIT',
      remittance_information: ['NETFLIX.COM ABBONAMENTO'],
      merchant_category_code: '5411', // supermercati — deliberatamente sbagliato
    }
    const mapped = mapTransactions(userId, 42, [row])
    // Netflix è seedato come merchant → categoria 'Abbonamenti': deve vincere sull'MCC.
    expect(categoryName(mapped[0].category_id)).toBe('Abbonamenti')
  })

  test('regola utente vince sia sull\'alias sia sull\'MCC', () => {
    const category = sqlite.prepare(`SELECT id FROM categories WHERE name = 'Intrattenimento'`).get() as { id: number }
    sqlite.prepare(
      `INSERT INTO category_rules (owner_id, pattern, category_id, priority) VALUES (?, 'netflix', ?, 10)`,
    ).run(userId, category.id)

    const row: EbTransaction = {
      entry_reference: 'mcc-ref-3',
      booking_date:    '2026-07-01',
      transaction_amount: { amount: '12.99', currency: 'EUR' },
      credit_debit_indicator: 'DBIT',
      remittance_information: ['NETFLIX.COM ABBONAMENTO'],
      merchant_category_code: '5411',
    }
    const mapped = mapTransactions(userId, 42, [row])
    expect(categoryName(mapped[0].category_id)).toBe('Intrattenimento')
  })

  test('nessun MCC, nessuna regola, nessun alias → category_id null (nessun crash)', () => {
    const row: EbTransaction = {
      entry_reference: 'mcc-ref-4',
      booking_date:    '2026-07-01',
      transaction_amount: { amount: '9.00', currency: 'EUR' },
      credit_debit_indicator: 'DBIT',
      remittance_information: ['MOVIMENTO GENERICO INDECIFRABILE'],
    }
    const mapped = mapTransactions(userId, 42, [row])
    expect(mapped[0].category_id).toBeNull()
  })
})
