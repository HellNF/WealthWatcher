// src/__tests__/lib/insights.test.ts — motore Considerazioni (puro)
import { computeInsights, type InsightInputs } from '@/lib/insights'
import type { RecurringItem } from '@/lib/analytics'

const TODAY = new Date('2026-07-12T12:00:00Z')

function quietInputs(): InsightInputs {
  return {
    cashflow: [],
    recurring: [],
    outliers: [],
    bridge: {
      hasData: false, month: '2026-06', isPartialMonth: false,
      totalActualMinor: 0, totalTypicalMinor: 0, totalDeltaMinor: 0,
      items: [], otherDeltaMinor: 0, monthsInBaseline: 0,
    },
    fixedVar: {
      hasData: false, fixedMonthlyMinor: 0, variableMonthlyMinor: 0,
      committedRatioPct: null, medianIncomeMinor: null, series: [],
    },
    inflation: { hasData: false, overallPct: null, items: [] },
    income: {
      hasData: false, salaryLabel: null, salaryMedianMinor: null,
      payDayMedian: null, payDayJitterDays: null, topSourceSharePct: null, sourceCount: 0,
    },
    pacing: {
      hasData: false, month: '2026-07', today: 12,
      actualToDateMinor: 0, typicalToDateMinor: 0, typicalEndMinor: 0,
      projectedEndMinor: 0, deviationPct: null, points: [], monthsInBaseline: 0,
    },
    concentration: { hasData: false, top5SharePct: null, topLabels: [] },
    yoy: { hasData: false, month: '2026-06', currentMinor: 0, lastYearMinor: 0, deltaPct: null },
    miscategorized: {
      hasData: false, expenseCount: 0, expenseTotalMinor: 0,
      incomeCount: 0, incomeTotalMinor: 0,
    },
    forecast: {
      hasData: false, avgMonthlyInflowMinor: 0, avgMonthlyOutflowMinor: 0,
      avgMonthlyNetMinor: 0, proj30Minor: 0, proj60Minor: 0, thresholdMinor: 0,
      crossesThresholdInDays: null, recurringOutflowMonthly: 0,
      wealthTaxMonthlyMinor: 0, plannedTransfersMonthlyMinor: 0,
    },
    pairCount: 0,
    hasMultipleCurrencies: false,
    today: TODAY,
  }
}

function recurringItem(partial: Partial<RecurringItem>): RecurringItem {
  return {
    key: 'm:1', merchant_id: 1, merchant_name: 'Netflix', description: 'Netflix',
    kind: 'subscription', cadence: 'monthly', cadenceLabel: 'mensile',
    amountMinor: 1799, monthlyEquivalentMinor: 1799, yearlyMinor: 1799 * 12,
    occurrences: 8, months: 8, firstDate: '2025-11-15', lastDate: '2026-07-01',
    status: 'active', nextExpectedDate: '2026-08-01',
    priceChangePct: null, oldAmountMinor: null,
    ...partial,
  }
}

describe('computeInsights', () => {
  test('input sotto soglia → nessun insight (il silenzio è una feature)', () => {
    expect(computeInsights(quietInputs())).toEqual([])
  })

  test('aumento prezzo abbonamento → warn con impatto annuo formattato', () => {
    const inputs = quietInputs()
    inputs.recurring = [recurringItem({ priceChangePct: 38.5, oldAmountMinor: 1299 })]
    const out = computeInsights(inputs)
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('price-increase:m:1')
    expect(out[0].severity).toBe('warn')
    // Δ 5€ × 12 = 60€/anno
    expect(out[0].impactMinor).toBe(6000)
    expect(out[0].body).toContain('12,99')
    expect(out[0].body).toContain('17,99')
    expect(out[0].impactLabel).toContain('/anno')
  })

  test('abbonamento cessato → opportunity col risparmio annuo', () => {
    const inputs = quietInputs()
    inputs.recurring = [recurringItem({ status: 'ceased', nextExpectedDate: null, lastDate: '2026-04-01' })]
    const out = computeInsights(inputs)
    expect(out).toHaveLength(1)
    expect(out[0].severity).toBe('opportunity')
    expect(out[0].impactMinor).toBe(1799 * 12)
  })

  test('aumento di prezzo sotto €12/anno viene taciuto', () => {
    const inputs = quietInputs()
    // Δ 0,50€/mese = 6€/anno → sotto soglia
    inputs.recurring = [recurringItem({ amountMinor: 1349, yearlyMinor: 1349 * 12, priceChangePct: 5.2, oldAmountMinor: 1299 })]
    expect(computeInsights(inputs)).toEqual([])
  })

  test('ranking: critical prima di warn prima di info, poi per impatto', () => {
    const inputs = quietInputs()
    inputs.forecast = { ...inputs.forecast, hasData: true, crossesThresholdInDays: 20, thresholdMinor: 100000, avgMonthlyNetMinor: -50000 }
    inputs.recurring = [
      recurringItem({ key: 'm:1', description: 'Piccolo', amountMinor: 500, yearlyMinor: 6000, priceChangePct: 20, oldAmountMinor: 400 }),
      recurringItem({ key: 'm:2', merchant_id: 2, description: 'Grande', amountMinor: 5000, yearlyMinor: 60000, priceChangePct: 25, oldAmountMinor: 4000 }),
    ]
    inputs.pairCount = 5 // info
    const out = computeInsights(inputs)
    expect(out[0].id).toBe('runway-low')
    expect(out[1].id).toBe('price-increase:m:2') // impatto maggiore
    expect(out[2].id).toBe('price-increase:m:1')
    expect(out.at(-1)!.severity).toBe('info')
  })

  test('cap a 8 insight', () => {
    const inputs = quietInputs()
    inputs.recurring = Array.from({ length: 12 }, (_, i) =>
      recurringItem({
        key: `m:${i}`, merchant_id: i, description: `Sub ${i}`,
        status: 'ceased', nextExpectedDate: null, lastDate: '2026-04-01',
        yearlyMinor: 10000 + i * 100,
      }),
    )
    expect(computeInsights(inputs)).toHaveLength(8)
  })

  test('driver del ponte mese → warn con href al report', () => {
    const inputs = quietInputs()
    inputs.bridge = {
      hasData: true, month: '2026-06', isPartialMonth: false,
      totalActualMinor: 150000, totalTypicalMinor: 100000, totalDeltaMinor: 50000,
      items: [{ categoryId: 1, categoryName: 'Ristorante & Bar', actualMinor: 60000, typicalMinor: 20000, deltaMinor: 40000 }],
      otherDeltaMinor: 10000, monthsInBaseline: 6,
    }
    const out = computeInsights(inputs)
    const driver = out.find((i) => i.id === 'bridge-driver:1')!
    expect(driver.severity).toBe('warn')
    expect(driver.body).toContain('giugno')
    expect(driver.body).toContain('Ristorante & Bar')
    expect(driver.href).toBe('/dashboard/reports')
  })

  test('igiene trasferimenti → info con conteggio coppie', () => {
    const inputs = quietInputs()
    inputs.pairCount = 4
    const out = computeInsights(inputs)
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('transfer-hygiene')
    expect(out[0].body).toContain('4 coppie')
  })
})
