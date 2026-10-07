// src/__tests__/lib/marketEvidence.test.ts — Evidenze storiche (dataset
// Shiller), andamenti dei mercati, storico delle valutazioni ed esposizione
// effettiva del portafoglio.
import {
  quantile, distribution, forwardReturns, capeBuckets, holdingStats, nearHighFlags, highStats, buildEquityEvidence,
} from '@/lib/marketOverview/evidence'
import { parseShillerRows, findShillerUrl, type ShillerRow } from '@/lib/marketOverview/shiller'
import { closeOnOrBefore, computeReturns } from '@/lib/marketOverview/performance'
import { mergeStancePoint, comparisonPoint, type StancePoint } from '@/lib/marketOverview/stanceHistory'
import { driverCape, driverExcessYield } from '@/lib/marketOverview/analysis/scoring'
import { computeExposure, exposurePct } from '@/lib/marketOverview/lookthrough'

/** Serie mensile sintetica: `annual` = crescita reale annua composta; CAPE costante salvo override. */
function synthetic(months: number, annual: number, cape: (i: number) => number | null = () => 20): ShillerRow[] {
  const monthly = Math.pow(1 + annual, 1 / 12)
  return Array.from({ length: months }, (_, i) => {
    const year = 1900 + Math.floor(i / 12)
    const level = 100 * Math.pow(monthly, i)
    return { date: `${year}-${String((i % 12) + 1).padStart(2, '0')}`, price: level, realTR: level, cape: cape(i), ecy: 3 }
  })
}

describe('dataset Shiller', () => {
  test('findShillerUrl normalizza il link protocol-relative', () => {
    const html = '<a href="//img1.wsimg.com/blobby/go/x/downloads/y/ie_data.xls?ver=1&amp;a=2">Data</a>'
    expect(findShillerUrl(html)).toBe('https://img1.wsimg.com/blobby/go/x/downloads/y/ie_data.xls?ver=1&a=2')
    expect(findShillerUrl('<a href="/altro.xls">x</a>')).toBeNull()
  })
  test('parseShillerRows: il mese viene dalla data frazionaria (2026.1 = ottobre)', () => {
    const row = (date: number, frac: number, cape: number | string) => {
      const r: unknown[] = []
      r[0] = date; r[1] = 7700; r[5] = frac; r[9] = 5_000_000; r[12] = cape; r[16] = 0.0056
      return r
    }
    const rows = parseShillerRows([
      ['Date', 'P'],                                   // intestazione: scartata
      row(1871.01, 1871.0416666666667, 'NA'),
      row(2026.1, 2026.791666666525, 40.7),
    ])
    expect(rows.map((r) => r.date)).toEqual(['1871-01', '2026-10'])
    expect(rows[0].cape).toBeNull()
    expect(rows[1].cape).toBe(40.7)
    expect(rows[1].ecy).toBeCloseTo(0.56)
  })
})

describe('statistiche storiche', () => {
  test('quantile interpola linearmente', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(quantile([10], 0.9)).toBe(10)
  })
  test('distribution: quota di esiti negativi', () => {
    const d = distribution([-2, -1, 1, 2, 3])!
    expect(d.pctNegative).toBe(40)
    expect(d.median).toBe(1)
    expect(distribution([])).toBeNull()
  })
  test('forwardReturns: crescita costante → rendimento annualizzato costante, null in coda', () => {
    const rows = synthetic(240, 0.05)
    const fwd = forwardReturns(rows, 10)
    expect(fwd[0]).toBeCloseTo(5, 6)
    expect(fwd[119]).toBeCloseTo(5, 6)
    expect(fwd[120]).toBeNull()
  })
  test('capeBuckets: assegna le partenze alla fascia giusta e marca quella corrente', () => {
    const rows = synthetic(360, 0.05, (i) => (i < 180 ? 12 : 32))
    const buckets = capeBuckets(rows, 32, 10)
    expect(buckets.map((b) => b.label)).toEqual(['10 – 15', 'oltre 30'])
    expect(buckets.find((b) => b.current)?.label).toBe('oltre 30')
    expect(buckets[0].n).toBe(180)
    expect(buckets[0].episodes).toBe(15)
    expect(buckets[0].median).toBeCloseTo(5, 1)
  })
  test('holdingStats: un mercato sempre in crescita non chiude mai in perdita', () => {
    const [oneYear] = holdingStats(synthetic(120, 0.05), [1])
    expect(oneYear.pctNegative).toBe(0)
    expect(oneYear.worst).toBeCloseTo(5, 1)
  })
  test('nearHighFlags: entro il 2% dal massimo corrente', () => {
    const mk = (price: number): ShillerRow => ({ date: '2000-01', price, realTR: price, cape: null, ecy: null })
    expect(nearHighFlags([100, 99, 90, 101, 98.5].map(mk))).toEqual([true, true, false, true, false])
  })
  test('highStats separa le partenze sui massimi dalle altre', () => {
    // Sale, scende sotto i massimi per un po', poi risale: esistono entrambe le categorie.
    const rows = synthetic(240, 0.05).map((r, i) => (i >= 60 && i < 100 ? { ...r, price: r.price * 0.7, realTR: r.realTR * 0.7 } : r))
    const [s] = highStats(rows, [1])
    expect(s.nearHigh.n).toBeGreaterThan(0)
    expect(s.other.n).toBeGreaterThan(0)
    expect(s.nearHigh.n + s.other.n).toBe(228)
  })
  test('buildEquityEvidence: null se l’ultimo mese non ha CAPE', () => {
    const rows = synthetic(1400, 0.05, (i) => (i === 1399 ? null : 20))
    expect(buildEquityEvidence(rows)).toBeNull()
    const ev = buildEquityEvidence(synthetic(1400, 0.05, (i) => 10 + i / 100))!
    expect(ev.capePctAll).toBe(100)
    expect(ev.nearHighNow).toBe(true)
    expect(ev.buckets.filter((b) => b.current)).toHaveLength(1)
  })
})

describe('driver di valutazione di lungo periodo', () => {
  const meta = { label: 'X', source: 'test', weight: 1 }
  test('CAPE su percentile alto → sfavorevole; ECY su percentile alto → favorevole', () => {
    expect(driverCape(meta, 40.7, 95, '30 anni').score).toBeLessThan(0)
    expect(driverCape(meta, 12, 5, '30 anni').score).toBeGreaterThan(0)
    expect(driverExcessYield(meta, 5, 90, '30 anni').score).toBeGreaterThan(0)
    expect(driverExcessYield(meta, 0.6, 12, '30 anni').score).toBeLessThan(0)
  })
  test('senza dataset il driver è escluso (peso 0) ma resta spiegato', () => {
    const d = driverCape(meta, null, null, '30 anni')
    expect(d.weight).toBe(0)
    expect(d.explain).toBeTruthy()
  })
})

describe('andamento dei mercati', () => {
  const pts = (list: [string, number][]) => list.map(([date, close]) => ({ date, close }))

  test('closeOnOrBefore prende l’ultima chiusura utile (festivi/weekend)', () => {
    const p = pts([['2026-01-02', 10], ['2026-01-05', 11], ['2026-01-06', 12]])
    expect(closeOnOrBefore(p, '2026-01-04')).toBe(10)
    expect(closeOnOrBefore(p, '2026-01-06')).toBe(12)
    expect(closeOnOrBefore(p, '2026-01-01')).toBeNull()
  })
  test('computeReturns: orizzonti, da inizio anno e distanza dal massimo', () => {
    const p = pts([
      ['2021-10-06', 50], ['2025-10-06', 96.8], ['2025-12-31', 100], ['2026-07-06', 125],
      ['2026-09-04', 110], ['2026-10-06', 121],
    ])
    const { returns, drawdownPct } = computeReturns(p)
    expect(returns.m1).toBe(10)          // 110 → 121
    expect(returns.m3).toBe(-3.2)        // 125 → 121
    expect(returns.ytd).toBe(21)         // 100 → 121
    expect(returns.y1).toBe(25)          // 96,8 → 121
    expect(returns.y5ann).toBeCloseTo(19.3, 1) // (121/50)^(1/5) − 1
    expect(drawdownPct).toBe(3.2)        // massimo a 125
  })
  test('computeReturns: storia più corta dell’orizzonte → null, non un numero inventato', () => {
    const p = pts([['2026-06-01', 100], ['2026-09-04', 110], ['2026-10-06', 121]])
    const { returns } = computeReturns(p)
    expect(returns.m1).toBe(10)
    expect(returns.y1).toBeNull()
    expect(returns.y5ann).toBeNull()
    expect(returns.ytd).toBeNull()
  })
})

describe('storico delle valutazioni', () => {
  const p = (d: string, stance: StancePoint['stance'] = 'neutral', score = 0): StancePoint => ({ d, stance, score })

  test('mergeStancePoint: una rilevazione al giorno, l’ultima vince, tetto rispettato', () => {
    const merged = mergeStancePoint([p('2026-07-14'), p('2026-10-06', 'neutral')], p('2026-10-06', 'caution', -0.5))
    expect(merged).toHaveLength(2)
    expect(merged[1].stance).toBe('caution')
    expect(mergeStancePoint([p('2026-01-01'), p('2026-01-02')], p('2026-01-03'), 2).map((x) => x.d)).toEqual(['2026-01-02', '2026-01-03'])
  })
  test('comparisonPoint: almeno ~un mese prima, altrimenti la più vecchia', () => {
    const pts = [p('2026-07-14'), p('2026-09-01'), p('2026-10-01'), p('2026-10-06')]
    expect(comparisonPoint(pts)?.d).toBe('2026-09-01')
    expect(comparisonPoint([p('2026-10-01'), p('2026-10-06')])?.d).toBe('2026-10-01')
    expect(comparisonPoint([p('2026-10-06')])).toBeNull()
  })
})

describe('esposizione effettiva (look-through dei fondi)', () => {
  const fund = (stock: number, bond: number, cash = 0, sectors: Record<string, number> = {}) => ({ stock, bond, cash, other: 0, sectors })

  test('un fondo bilanciato viene ripartito, non contato tutto come azionario', () => {
    const positions = [
      { instrumentId: 1, cluster: 'etf' as const, valueEurMinor: 600_00 },   // 50% azioni, 40% bond, 10% cash
      { instrumentId: 2, cluster: 'etf' as const, valueEurMinor: 300_00 },   // 100% azioni
      { instrumentId: 3, cluster: 'crypto' as const, valueEurMinor: 100_00 },
    ]
    const ex = computeExposure(positions, { 1: fund(0.5, 0.4, 0.1), 2: fund(1, 0) })
    expect(ex.hasLookthrough).toBe(true)
    expect(exposurePct(ex, 'equity')).toBeCloseTo(60)   // 300 + 300 su 1000
    expect(exposurePct(ex, 'bond')).toBeCloseTo(24)
    expect(exposurePct(ex, 'cash')).toBeCloseTo(6)
    expect(exposurePct(ex, 'crypto')).toBeCloseTo(10)
    expect(ex.slices.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(100)
  })
  test('un fondo senza composizione nota resta "unknown", mai azionario d’ufficio', () => {
    const ex = computeExposure([{ instrumentId: 9, cluster: 'etf', valueEurMinor: 500_00 }], {})
    expect(ex.hasLookthrough).toBe(false)
    expect(exposurePct(ex, 'unknown')).toBe(100)
    expect(exposurePct(ex, 'equity')).toBe(0)
  })
  test('quote che non sommano a 1 vengono normalizzate; settori pesati per la parte azionaria', () => {
    const ex = computeExposure(
      [
        { instrumentId: 1, cluster: 'etf', valueEurMinor: 1000_00 },
        { instrumentId: 2, cluster: 'etf', valueEurMinor: 1000_00 },
      ],
      { 1: fund(0.98, 0, 0, { technology: 0.6, healthcare: 0.4 }), 2: fund(0.49, 0.49, 0, { technology: 1 }) },
    )
    expect(exposurePct(ex, 'equity')).toBeCloseTo(75)  // 1000 + 500 su 2000
    // tecnologia: 600 + 500 = 1100 su 1500 di azionario
    expect(ex.sectors[0]).toEqual({ key: 'technology', pct: expect.closeTo(73.33, 1) })
    expect(ex.sectors[1].key).toBe('healthcare')
  })
})
