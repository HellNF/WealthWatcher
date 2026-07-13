// src/__tests__/lib/outliers.test.ts — outlier robusti v2 (funzione pura)
import { detectRecurring, spendingOutliers } from '@/lib/analytics'
import type { FlowTxn } from '@/lib/spending'

const TODAY = new Date('2026-07-12T12:00:00Z')

let nextId = 1
function txn(partial: Partial<FlowTxn> & { booked_date: string; amount_minor: number }): FlowTxn {
  return {
    id: nextId++,
    bank_account_id: 1,
    category_id: 1,
    category_name: 'Supermercato',
    category_kind: 'expense',
    merchant_id: null,
    merchant_name: null,
    description_raw: 'txn',
    ...partial,
  }
}

/** Baseline con variabilità: importi attorno ai 30€ su più mesi recenti. */
function baseline(): FlowTxn[] {
  const amounts = [2800, 2900, 3000, 3000, 3100, 3200, 2700, 3300]
  const months = ['2026-02', '2026-02', '2026-03', '2026-03', '2026-04', '2026-05', '2026-06', '2026-06']
  return amounts.map((a, i) =>
    txn({ booked_date: `${months[i]}-1${i % 9}`, amount_minor: -a, description_raw: `Spesa ${i}` }),
  )
}

describe('spendingOutliers v2', () => {
  test('€400 in una categoria da ~€30 → outlier con z robusto alto', () => {
    const txns = [...baseline(), txn({ booked_date: '2026-07-05', amount_minor: -40000, description_raw: 'Spesona' })]
    const out = spendingOutliers(txns, [], TODAY)
    expect(out).toHaveLength(1)
    expect(out[0].description).toBe('Spesona')
    expect(out[0].categoryMedianMinor).toBe(3000)
    expect(out[0].robustZ).toBeGreaterThanOrEqual(3.5)
    expect(out[0].excessMinor).toBe(37000)
  })

  test('MAD = 0 (importi identici) → fallback su 3× mediana', () => {
    const identical = Array.from({ length: 8 }, (_, i) =>
      txn({ booked_date: `2026-0${(i % 5) + 2}-10`, amount_minor: -3000, category_id: 2, category_name: 'Utenze', description_raw: `Fissa ${i}` }),
    )
    // 3× mediana = 90€, ma serve anche ≥ €50 → 100€ passa
    const withOutlier = [...identical, txn({ booked_date: '2026-07-01', amount_minor: -10000, category_id: 2, category_name: 'Utenze', description_raw: 'Conguaglio' })]
    const out = spendingOutliers(withOutlier, [], TODAY)
    expect(out).toHaveLength(1)
    expect(out[0].description).toBe('Conguaglio')
    // Sotto il 3×: 80€ < 90€ → nessun outlier
    const withSmall = [...identical, txn({ booked_date: '2026-07-01', amount_minor: -8000, category_id: 2, category_name: 'Utenze', description_raw: 'Piccolo' })]
    expect(spendingOutliers(withSmall, [], TODAY)).toHaveLength(0)
  })

  test('outlier più vecchio di 6 mesi non viene riportato', () => {
    const txns = [...baseline(), txn({ booked_date: '2026-01-05', amount_minor: -40000, description_raw: 'Vecchia spesona' })]
    const out = spendingOutliers(txns, [], TODAY)
    expect(out).toHaveLength(0)
  })

  test('sotto la materialità (€25 minimi) non scatta', () => {
    // Categoria di micro-importi: mediana €2, candidato €20 → z alto ma < €25
    const micro = Array.from({ length: 10 }, (_, i) =>
      txn({ booked_date: `2026-0${(i % 5) + 2}-05`, amount_minor: -(180 + i * 10), category_id: 3, category_name: 'Caffè', description_raw: `Caffè ${i}` }),
    )
    const txns = [...micro, txn({ booked_date: '2026-07-01', amount_minor: -2000, category_id: 3, category_name: 'Caffè', description_raw: 'Caffè gigante' })]
    expect(spendingOutliers(txns, [], TODAY)).toHaveLength(0)
  })

  test("l'addebito di un ricorrente attivo non è un'anomalia", () => {
    // Bolletta trimestrale da ~€300 dentro una categoria con baseline ~€30
    const bills = ['2025-10-10', '2026-01-09', '2026-04-11', '2026-07-10'].map((d) =>
      txn({ booked_date: d, amount_minor: -30000, merchant_id: 9, merchant_name: 'Enel', category_id: 1, description_raw: 'Enel' }),
    )
    const txns = [...baseline(), ...bills]
    const recurring = detectRecurring(txns, TODAY)
    expect(recurring.some((r) => r.merchant_id === 9)).toBe(true)

    const withRecurring = spendingOutliers(txns, recurring, TODAY)
    expect(withRecurring.filter((o) => o.description === 'Enel')).toHaveLength(0)

    // Senza la lista ricorrenti la stessa transazione verrebbe flaggata
    const withoutRecurring = spendingOutliers(txns, [], TODAY)
    expect(withoutRecurring.some((o) => o.description === 'Enel')).toBe(true)
  })

  test('baseline sotto 8 transazioni → categoria ignorata', () => {
    const few = Array.from({ length: 5 }, (_, i) =>
      txn({ booked_date: `2026-0${i + 2}-10`, amount_minor: -3000, category_id: 4, category_name: 'Sport', description_raw: `S${i}` }),
    )
    const txns = [...few, txn({ booked_date: '2026-07-01', amount_minor: -50000, category_id: 4, category_name: 'Sport', description_raw: 'Bici' })]
    expect(spendingOutliers(txns, [], TODAY)).toHaveLength(0)
  })
})
