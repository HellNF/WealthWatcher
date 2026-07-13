// src/__tests__/lib/spendingInsights.test.ts — metriche contabili avanzate (funzioni pure)
import {
  monthBridge,
  monthPacing,
  fixedVariableSplit,
  personalInflation,
  sameMonthYoY,
} from '@/lib/spendingInsights'
import type { FlowTxn } from '@/lib/spending'
import type { MonthlyCashflow, RecurringItem } from '@/lib/analytics'

// Oggi = 12 luglio 2026 (giorno < 25 → il mese focus del bridge è giugno)
const TODAY = new Date('2026-07-12T12:00:00Z')

let nextId = 1
function txn(date: string, amountMinor: number, catId: number | null, catName: string | null, desc = 'txn'): FlowTxn {
  return {
    id: nextId++,
    booked_date: date,
    amount_minor: amountMinor,
    category_id: catId,
    category_name: catName,
    category_kind: catId !== null ? 'expense' : null,
    merchant_id: null,
    merchant_name: null,
    description_raw: desc,
  }
}

describe('monthBridge', () => {
  test('delta per categoria vs mediana dei mesi precedenti, zeri inclusi', () => {
    const txns: FlowTxn[] = []
    // Ristoranti: 100€ a marzo, aprile, maggio → mediana 100€; giugno 250€ → Δ +150€
    for (const m of ['2026-03', '2026-04', '2026-05']) txns.push(txn(`${m}-10`, -10000, 1, 'Ristorante & Bar'))
    txns.push(txn('2026-06-10', -25000, 1, 'Ristorante & Bar'))
    // Carburante: 80€ in tutti e 3 i mesi baseline, 0€ a giugno → Δ −80€
    for (const m of ['2026-03', '2026-04', '2026-05']) txns.push(txn(`${m}-05`, -8000, 2, 'Carburante'))
    // Shopping: appare solo a maggio (60€) → mediana con zeri = 0 → giugno 90€ → Δ +90€
    txns.push(txn('2026-05-20', -6000, 3, 'Shopping'))
    txns.push(txn('2026-06-20', -9000, 3, 'Shopping'))

    const b = monthBridge(txns, TODAY)
    expect(b.hasData).toBe(true)
    expect(b.month).toBe('2026-06')
    expect(b.isPartialMonth).toBe(false)

    const rist = b.items.find((i) => i.categoryName === 'Ristorante & Bar')!
    expect(rist.typicalMinor).toBe(10000)
    expect(rist.deltaMinor).toBe(15000)

    const carb = b.items.find((i) => i.categoryName === 'Carburante')!
    expect(carb.actualMinor).toBe(0)
    expect(carb.deltaMinor).toBe(-8000)

    const shop = b.items.find((i) => i.categoryName === 'Shopping')!
    expect(shop.typicalMinor).toBe(0)  // mediana di [0, 0, 6000] = 0
    expect(shop.deltaMinor).toBe(9000)

    expect(b.totalDeltaMinor).toBe(b.totalActualMinor - b.totalTypicalMinor)
  })

  test('meno di 3 mesi completi → hasData false', () => {
    const txns = [
      txn('2026-05-10', -10000, 1, 'Ristorante & Bar'),
      txn('2026-06-10', -25000, 1, 'Ristorante & Bar'),
    ]
    expect(monthBridge(txns, TODAY).hasData).toBe(false)
  })

  test('a fine mese (giorno ≥ 25) il focus è il mese corrente, flag parziale', () => {
    const endOfMonth = new Date('2026-07-27T12:00:00Z')
    const txns: FlowTxn[] = []
    for (const m of ['2026-04', '2026-05', '2026-06']) txns.push(txn(`${m}-10`, -10000, 1, 'Ristorante & Bar'))
    txns.push(txn('2026-07-10', -30000, 1, 'Ristorante & Bar'))
    const b = monthBridge(txns, endOfMonth)
    expect(b.month).toBe('2026-07')
    expect(b.isPartialMonth).toBe(true)
  })

  test('delta sotto soglia finiscono in otherDeltaMinor', () => {
    const txns: FlowTxn[] = []
    // Δ di 10€: sotto i €20 minimi
    for (const m of ['2026-03', '2026-04', '2026-05']) txns.push(txn(`${m}-10`, -10000, 1, 'Ristorante & Bar'))
    txns.push(txn('2026-06-10', -11000, 1, 'Ristorante & Bar'))
    const b = monthBridge(txns, TODAY)
    expect(b.items).toHaveLength(0)
    expect(b.otherDeltaMinor).toBe(1000)
  })
})

describe('monthPacing', () => {
  test('proiezione = attuale + (tipico fine mese − tipico a oggi)', () => {
    const txns: FlowTxn[] = []
    // Baseline: aprile/maggio/giugno con 100€ il giorno 5 e 100€ il giorno 20 → fine mese 200€
    for (const m of ['2026-04', '2026-05', '2026-06']) {
      txns.push(txn(`${m}-05`, -10000, 1, 'Spesa'))
      txns.push(txn(`${m}-20`, -10000, 1, 'Spesa'))
    }
    // Luglio: 150€ il giorno 5 (sopra il ritmo tipico)
    txns.push(txn('2026-07-05', -15000, 1, 'Spesa'))

    const p = monthPacing(txns, TODAY)  // oggi = 12 luglio
    expect(p.hasData).toBe(true)
    expect(p.actualToDateMinor).toBe(15000)
    expect(p.typicalToDateMinor).toBe(10000)   // al giorno 12 il tipico ha solo la spesa del giorno 5
    expect(p.typicalEndMinor).toBe(20000)
    // 15000 + (20000 − 10000) = 25000
    expect(p.projectedEndMinor).toBe(25000)
    expect(p.deviationPct).toBe(50)
    expect(p.points).toHaveLength(31)
    expect(p.points[0].typicalMinor).toBe(0)
    expect(p.points[4].actualMinor).toBe(15000)  // giorno 5
    expect(p.points.at(-1)!.projectedMinor).toBe(25000)
  })

  test('prima del giorno 5 → hasData false', () => {
    const early = new Date('2026-07-03T12:00:00Z')
    expect(monthPacing([], early).hasData).toBe(false)
  })
})

describe('fixedVariableSplit', () => {
  test('categorie vincolate e ricorrenti attivi finiscono nei fissi', () => {
    const txns: FlowTxn[] = []
    for (const m of ['2026-04', '2026-05', '2026-06']) {
      txns.push(txn(`${m}-01`, -70000, 10, 'Mutuo'))       // fisso via categoria
      txns.push(txn(`${m}-15`, -20000, 3, 'Shopping'))     // variabile
    }
    const cashflow = ['2026-04', '2026-05', '2026-06'].map((month) => ({
      month, inflow: 200000, outflow: 90000, net: 110000,
      transferOutMinor: 0, transferInMinor: 0,
      savingsRate: 55, expenseSavingsRate: 55, investmentRate: 0,
    })) as MonthlyCashflow[]

    const s = fixedVariableSplit(txns, [] as RecurringItem[], cashflow, TODAY)
    expect(s.hasData).toBe(true)
    expect(s.fixedMonthlyMinor).toBe(70000)
    expect(s.variableMonthlyMinor).toBe(20000)
    expect(s.committedRatioPct).toBe(35)  // 700 / 2000
    expect(s.series).toHaveLength(3)
  })
})

describe('personalInflation', () => {
  test('serve almeno 13 mesi di storia', () => {
    const txns = [txn('2026-01-10', -3000, 1, 'Supermercato', 'Esselunga Milano')]
    expect(personalInflation(txns, TODAY).hasData).toBe(false)
  })

  test('rileva il rincaro dello scontrino mediano', () => {
    const txns: FlowTxn[] = []
    // Finestra vecchia (mesi −12…−7): scontrini da 30€
    for (const m of ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12']) {
      txns.push(txn(`${m}-10`, -3000, 1, 'Supermercato', 'Esselunga Milano Store'))
    }
    // Finestra recente (ultimi 6 mesi): scontrini da 33€ (+10%)
    for (const m of ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06']) {
      txns.push(txn(`${m}-10`, -3300, 1, 'Supermercato', 'Esselunga Milano Store'))
    }
    // Ancoraggio a >13 mesi di storia
    txns.unshift(txn('2025-05-01', -3000, 1, 'Supermercato', 'Esselunga Milano Store'))
    txns.sort((a, b) => a.booked_date.localeCompare(b.booked_date))

    const inf = personalInflation(txns, TODAY)
    expect(inf.hasData).toBe(true)
    expect(inf.items).toHaveLength(1)
    expect(inf.items[0].deltaPct).toBe(10)
    expect(inf.overallPct).toBe(10)
  })
})

describe('sameMonthYoY', () => {
  test('confronta ultimo mese completo con lo stesso mese di un anno fa', () => {
    const txns = [
      txn('2025-06-10', -50000, 1, 'Spesa'),
      txn('2026-06-10', -60000, 1, 'Spesa'),
    ]
    const y = sameMonthYoY(txns, TODAY)
    expect(y.hasData).toBe(true)
    expect(y.month).toBe('2026-06')
    expect(y.deltaPct).toBe(20)
  })

  test('senza il mese di un anno fa → hasData false', () => {
    const y = sameMonthYoY([txn('2026-06-10', -60000, 1, 'Spesa')], TODAY)
    expect(y.hasData).toBe(false)
  })
})
