// src/__tests__/lib/marketScoring.test.ts — Motore di sintesi: convenzioni di
// segno, aggregazione con rinormalizzazione, soglie stance, confidenza.
import {
  aggregate, stanceFromScore, confidenceFromCoverage, synthesize,
  driverPricePercentile, driverYieldPercentile, driverRealYield,
  driverCurveSlope, driverVix, driverFearGreed, driverPE,
} from '@/lib/marketOverview/analysis/scoring'
import type { Driver } from '@/lib/marketOverview/analysis/types'

const meta = (label = 'X', weight = 1) => ({ label, source: 'test', weight })

describe('convenzioni di segno dei driver', () => {
  test('prezzo caro (95° pct) → sfavorevole (score<0)', () => {
    expect(driverPricePercentile(meta(), 95, '10a').score).toBeLessThan(0)
  })
  test('prezzo economico (5° pct) → favorevole (score>0)', () => {
    expect(driverPricePercentile(meta(), 5, '10a').score).toBeGreaterThan(0)
  })
  test('rendimento bond alto (90° pct) → favorevole', () => {
    expect(driverYieldPercentile(meta(), 90, '10a').score).toBeGreaterThan(0)
  })
  test('rendimento reale positivo → favorevole', () => {
    expect(driverRealYield(meta(), 1.5).score).toBeGreaterThan(0)
  })
  test('curva invertita → cautela (score<0)', () => {
    expect(driverCurveSlope(meta(), -0.5).score).toBeLessThan(0)
  })
  test('VIX alto (paura) → favorevole; basso → sfavorevole', () => {
    expect(driverVix(meta(), 40).score).toBeGreaterThan(0)
    expect(driverVix(meta(), 12).score).toBeLessThan(0)
  })
  test('Fear&Greed avidità estrema → cautela; paura estrema → favorevole', () => {
    expect(driverFearGreed(meta(), 85).score).toBeLessThan(0)
    expect(driverFearGreed(meta(), 15).score).toBeGreaterThan(0)
  })
  test('dato mancante → peso 0, detail "dato non disponibile"', () => {
    const d = driverPE(meta(), null)
    expect(d.weight).toBe(0)
    expect(Number.isNaN(d.score)).toBe(true)
    expect(d.detail).toContain('non disponibile')
  })
})

describe('aggregate — rinormalizza sui driver presenti', () => {
  test('ignora i driver a peso 0 (dato mancante)', () => {
    const drivers: Driver[] = [
      { label: 'a', detail: '', reading: 'favorable', score: 1, weight: 1, source: 't' },
      { label: 'b', detail: '', reading: 'neutral', score: NaN, weight: 0, source: 't' },
    ]
    expect(aggregate(drivers)).toBe(1) // solo 'a' conta
  })
  test('media pesata corretta', () => {
    const drivers: Driver[] = [
      { label: 'a', detail: '', reading: 'favorable', score: 1, weight: 3, source: 't' },
      { label: 'b', detail: '', reading: 'unfavorable', score: -1, weight: 1, source: 't' },
    ]
    expect(aggregate(drivers)).toBeCloseTo(0.5) // (3-1)/4
  })
  test('nessun driver valido → 0', () => {
    expect(aggregate([])).toBe(0)
  })
})

describe('stance e confidence', () => {
  test('soglie stance', () => {
    expect(stanceFromScore(0.5)).toBe('accumulate')
    expect(stanceFromScore(0.2)).toBe('lean-accumulate')
    expect(stanceFromScore(0)).toBe('neutral')
    expect(stanceFromScore(-0.2)).toBe('lean-caution')
    expect(stanceFromScore(-0.5)).toBe('caution')
  })
  test('confidenza da copertura', () => {
    expect(confidenceFromCoverage(5, 5)).toBe('alta')
    expect(confidenceFromCoverage(3, 5)).toBe('media')
    expect(confidenceFromCoverage(1, 5)).toBe('bassa')
  })
})

describe('synthesize', () => {
  test('quadro caro → stance di cautela, narrativa con motivi di cautela', () => {
    const drivers = [
      driverPricePercentile(meta('Valutazione', 2), 96, '10 anni'),
      driverFearGreed(meta('Sentiment', 1), 82),
    ]
    const a = synthesize({ key: 'x', title: 'Oro', drivers, asOf: 1 })
    expect(['caution', 'lean-caution']).toContain(a.stance)
    expect(a.narrative).toContain('cautela')
    expect(a.confidence).toBe('alta')
  })

  test('driver mancanti abbassano la confidenza', () => {
    const drivers = [
      driverPricePercentile(meta('Valutazione', 2), 96, '10 anni'),
      driverPE(meta('P/E', 1), null),
      driverVix(meta('VIX', 1), null),
    ]
    const a = synthesize({ key: 'x', title: 'USA', drivers, asOf: 1 })
    expect(a.confidence).not.toBe('alta') // solo 1 driver su 3 presente
  })
})
