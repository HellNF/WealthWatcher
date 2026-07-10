// src/__tests__/lib/banking-sync.test.ts — Mapping EbTransaction →
// InsertableTransaction: segno dell'importo, dedup idempotente su
// entry_reference, fallback a occorrenza in-batch quando assente.
import { mapTransactions } from '@/lib/banking/sync'
import type { EbTransaction } from '@/lib/banking/types'

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
