// src/__tests__/lib/marketSignals.test.ts — Classificatore percentile→livello.
// Verifica che le etichette derivino da soglie fisse e che gli edge case
// (storia vuota, valore agli estremi) non producano né crash né etichette
// inventate.
import {
  percentileOf,
  levelFromPercentile,
  buildPercentileSignal,
  downsample,
} from '@/lib/marketOverview/signals'

describe('percentileOf', () => {
  test('valore mediano → ~50°', () => {
    const p = percentileOf(5, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(p).toBe(50)
  })

  test('valore massimo → 100°', () => {
    expect(percentileOf(10, [1, 2, 3, 10])).toBe(100)
  })

  test('valore sotto tutti → 0°', () => {
    expect(percentileOf(0, [1, 2, 3])).toBe(0)
  })

  test('storia vuota → null (nessun crash)', () => {
    expect(percentileOf(5, [])).toBeNull()
  })

  test('ignora valori non finiti', () => {
    expect(percentileOf(5, [1, NaN, 10, Infinity])).toBe(50) // su [1,10]
  })
})

describe('levelFromPercentile', () => {
  test('≥90° → high', () => expect(levelFromPercentile(95)).toBe('high'))
  test('≤10° → low', () => expect(levelFromPercentile(5)).toBe('low'))
  test('in mezzo → normal', () => expect(levelFromPercentile(50)).toBe('normal'))
  test('esattamente 90 → high (inclusivo)', () => expect(levelFromPercentile(90)).toBe('high'))
  test('esattamente 10 → low (inclusivo)', () => expect(levelFromPercentile(10)).toBe('low'))
  test('percentile null → null', () => expect(levelFromPercentile(null)).toBeNull())
  test('bande custom', () => expect(levelFromPercentile(80, { low: 25, high: 75 })).toBe('high'))
})

describe('buildPercentileSignal', () => {
  test('oro al 95° percentile → level high, testo su prezzo', () => {
    const history = Array.from({ length: 100 }, (_, i) => i) // 0..99
    const s = buildPercentileSignal({
      code: 'commodities.gold', title: 'Oro', value: 96, unit: '$',
      history, window: '10 anni', source: 'Yahoo Finance', asOf: 1000, noun: 'prezzo',
    })
    expect(s.level).toBe('high')
    expect(s.percentile).toBe(97) // 97 valori (0..96) ≤ 96 su 100
    expect(s.levelText).toContain('Prezzo')
    expect(s.levelText).toContain('elevato')
    expect(s.source).toBe('Yahoo Finance')
  })

  test('storia vuota → percentile null, level null, nessun crash', () => {
    const s = buildPercentileSignal({
      code: 'x', title: 'X', value: 5, unit: '', history: [],
      window: '10 anni', source: 'Test', asOf: 1,
    })
    expect(s.percentile).toBeNull()
    expect(s.level).toBeNull()
    expect(s.levelText).toBe('Contesto storico non disponibile')
  })

  test('flag estimated propagato', () => {
    const s = buildPercentileSignal({
      code: 'equities.cape', title: 'CAPE', value: 30, unit: '', history: [10, 20, 40],
      window: 'dal 1990', source: 'stima', asOf: 1, estimated: true,
    })
    expect(s.estimated).toBe(true)
  })

  test('serie downsampled ed explanation generata dal percentile', () => {
    const history = Array.from({ length: 300 }, (_, i) => i)
    const series = history.map((v) => ({ t: `d${v}`, v }))
    const s = buildPercentileSignal({
      code: 'commodities.gold', title: 'Oro', value: 285, unit: '$', history,
      window: '10 anni', source: 'Yahoo Finance', asOf: 1, noun: 'prezzo', series,
    })
    expect(s.series!.length).toBeLessThanOrEqual(121)
    expect(s.series![s.series!.length - 1].t).toBe('d299') // ultimo sempre preservato
    expect(s.explanation).toContain('più alto')
    expect(s.explanation).toContain('10 anni')
  })
})

describe('downsample', () => {
  test('sotto soglia → invariata', () => {
    const pts = [{ t: 'a', v: 1 }, { t: 'b', v: 2 }]
    expect(downsample(pts, 120)).toBe(pts)
  })
  test('sopra soglia → ridotta e ultimo preservato', () => {
    const pts = Array.from({ length: 500 }, (_, i) => ({ t: String(i), v: i }))
    const out = downsample(pts, 100)
    expect(out.length).toBeLessThanOrEqual(101)
    expect(out[out.length - 1].t).toBe('499')
  })
})
