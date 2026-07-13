// src/__tests__/lib/recurring.test.ts — motore ricorrenti v2 (funzione pura)
import { detectRecurring } from '@/lib/analytics'
import type { FlowTxn } from '@/lib/spending'

const TODAY = new Date('2026-07-12T12:00:00Z')

let nextId = 1
function txn(partial: Partial<FlowTxn> & { booked_date: string; amount_minor: number }): FlowTxn {
  return {
    id: nextId++,
    bank_account_id: 1,
    category_id: null,
    category_name: null,
    category_kind: null,
    merchant_id: null,
    merchant_name: null,
    description_raw: 'txn',
    ...partial,
  }
}

/** Genera addebiti mensili con jitter sui giorni. */
function monthlySeries(
  merchantId: number, name: string, amounts: number[],
  startYear = 2025, startMonth = 9, days: number[] = [],
): FlowTxn[] {
  return amounts.map((a, i) => {
    const m = startMonth + i
    const y = startYear + Math.floor((m - 1) / 12)
    const mm = String(((m - 1) % 12) + 1).padStart(2, '0')
    const dd = String(days[i] ?? 15).padStart(2, '0')
    return txn({
      booked_date: `${y}-${mm}-${dd}`,
      amount_minor: -a,
      merchant_id: merchantId,
      merchant_name: name,
      description_raw: name,
    })
  })
}

describe('detectRecurring — cadenza e classificazione', () => {
  test('abbonamento mensile con jitter ±2gg → subscription mensile, ×12', () => {
    const txns = monthlySeries(1, 'Netflix', [1299, 1299, 1299, 1299, 1299, 1299],
      2026, 1, [15, 14, 16, 15, 13, 15])
    const items = detectRecurring(txns, TODAY)
    expect(items).toHaveLength(1)
    const r = items[0]
    expect(r.kind).toBe('subscription')
    expect(r.cadence).toBe('monthly')
    expect(r.amountMinor).toBe(1299)
    expect(r.yearlyMinor).toBe(1299 * 12)
    expect(r.status).toBe('active')
    expect(r.nextExpectedDate).not.toBeNull()
    expect(r.priceChangePct).toBeNull()
  })

  test('canone settimanale fisso → weekly, annualizzato ×52', () => {
    const txns: FlowTxn[] = []
    for (let i = 0; i < 10; i++) {
      const d = new Date(Date.parse('2026-05-04') + i * 7 * 86_400_000)
      txns.push(txn({
        booked_date: d.toISOString().slice(0, 10),
        amount_minor: -999,
        merchant_id: 2, merchant_name: 'Palestra Weekly', description_raw: 'Palestra Weekly',
      }))
    }
    const items = detectRecurring(txns, TODAY)
    expect(items).toHaveLength(1)
    expect(items[0].cadence).toBe('weekly')
    expect(items[0].yearlyMinor).toBe(999 * 52)
  })

  test('spesa settimanale con importi variabili → habit, MAI ×52', () => {
    const amounts = [4200, 6800, 3100, 5500, 7200, 2900, 6100, 4800, 3900, 7000, 4400, 5800]
    const txns: FlowTxn[] = amounts.map((a, i) => {
      const d = new Date(Date.parse('2026-04-04') + i * 7 * 86_400_000)
      return txn({
        booked_date: d.toISOString().slice(0, 10),
        amount_minor: -a,
        merchant_id: 3, merchant_name: 'Esselunga', description_raw: 'Esselunga',
      })
    })
    const items = detectRecurring(txns, TODAY)
    expect(items).toHaveLength(1)
    const r = items[0]
    expect(r.kind).toBe('habit')
    expect(r.cadence).toBeNull()
    const total = amounts.reduce((s, a) => s + a, 0)
    const distinctMonths = new Set(txns.map((t) => t.booked_date.slice(0, 7))).size
    expect(r.monthlyEquivalentMinor).toBe(Math.round(total / distinctMonths))
    expect(r.yearlyMinor).toBe(r.monthlyEquivalentMinor * 12)
  })

  test('bolletta trimestrale a importo variabile → quarterly bill, ×4', () => {
    const txns = [
      txn({ booked_date: '2025-10-10', amount_minor: -8500,  merchant_id: 4, merchant_name: 'Enel', description_raw: 'Enel' }),
      txn({ booked_date: '2026-01-09', amount_minor: -12100, merchant_id: 4, merchant_name: 'Enel', description_raw: 'Enel' }),
      txn({ booked_date: '2026-04-11', amount_minor: -6800,  merchant_id: 4, merchant_name: 'Enel', description_raw: 'Enel' }),
      txn({ booked_date: '2026-07-10', amount_minor: -9900,  merchant_id: 4, merchant_name: 'Enel', description_raw: 'Enel' }),
    ]
    const items = detectRecurring(txns, TODAY)
    expect(items).toHaveLength(1)
    const r = items[0]
    expect(r.cadence).toBe('quarterly')
    expect(r.kind).toBe('bill')
    expect(r.yearlyMinor).toBe(r.amountMinor * 4)
  })

  test('bolletta trimestrale a importo stabile → subscription trimestrale', () => {
    const txns = [
      txn({ booked_date: '2025-10-10', amount_minor: -8500, merchant_id: 10, merchant_name: 'Fibra', description_raw: 'Fibra' }),
      txn({ booked_date: '2026-01-09', amount_minor: -8500, merchant_id: 10, merchant_name: 'Fibra', description_raw: 'Fibra' }),
      txn({ booked_date: '2026-04-11', amount_minor: -8600, merchant_id: 10, merchant_name: 'Fibra', description_raw: 'Fibra' }),
      txn({ booked_date: '2026-07-10', amount_minor: -8600, merchant_id: 10, merchant_name: 'Fibra', description_raw: 'Fibra' }),
    ]
    const items = detectRecurring(txns, TODAY)
    expect(items).toHaveLength(1)
    expect(items[0].kind).toBe('subscription')
    expect(items[0].cadence).toBe('quarterly')
  })

  test('aumento di prezzo 12,99 → 17,99 flaggato', () => {
    const txns = monthlySeries(5, 'Streaming',
      [1299, 1299, 1299, 1799, 1799, 1799], 2026, 1)
    const items = detectRecurring(txns, TODAY)
    expect(items).toHaveLength(1)
    const r = items[0]
    expect(r.priceChangePct).toBeCloseTo(38.5, 0)
    expect(r.oldAmountMinor).toBe(1299)
    expect(r.amountMinor).toBe(1799)
  })

  test('ultimo addebito 70gg fa su cadenza mensile → ceased', () => {
    const txns = monthlySeries(6, 'Rivista', [500, 500, 500, 500], 2025, 11)
    // ultimo addebito 2026-02-15 → oggi 2026-07-12 → ben oltre 1.8×30gg
    const items = detectRecurring(txns, TODAY)
    expect(items).toHaveLength(1)
    expect(items[0].status).toBe('ceased')
    expect(items[0].nextExpectedDate).toBeNull()
  })

  test('materialità: sotto €20/anno viene scartato', () => {
    const txns = monthlySeries(7, 'Micro', [100, 100, 100, 100], 2026, 2)
    expect(detectRecurring(txns, TODAY)).toHaveLength(0)
  })

  test('canone annuale con 2 occorrenze → annual ×1', () => {
    const txns = [
      txn({ booked_date: '2025-06-20', amount_minor: -12000, merchant_id: 8, merchant_name: 'Assicurazione', description_raw: 'Assicurazione' }),
      txn({ booked_date: '2026-06-21', amount_minor: -12500, merchant_id: 8, merchant_name: 'Assicurazione', description_raw: 'Assicurazione' }),
    ]
    const items = detectRecurring(txns, TODAY)
    expect(items).toHaveLength(1)
    expect(items[0].cadence).toBe('annual')
    expect(items[0].yearlyMinor).toBe(items[0].amountMinor * 1)
  })

  test('senza merchant raggruppa per descrizione normalizzata', () => {
    const txns = monthlySeries(0, '', [2500, 2500, 2500, 2500], 2026, 2)
      .map((t) => ({ ...t, merchant_id: null, merchant_name: null, description_raw: 'ADDEBITO SEPA Vodafone 12345' }))
    const items = detectRecurring(txns, TODAY)
    expect(items).toHaveLength(1)
    expect(items[0].description).toContain('vodafone')
  })
})
