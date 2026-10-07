// src/__tests__/lib/marketMacro.test.ts — Quadro macro: parser delle fonti,
// helper sulle serie e classificatori a soglie fisse.
import {
  yoyFromLevels, direction, lastRateChange, periodLabel, delPct, lagged,
  classifyInflation, classifyPolicy, classifyGrowth, classifyStress,
} from '@/lib/marketOverview/macro'
import { parseFredCsv } from '@/lib/marketOverview/fred'
import { parseJsonStatSeries } from '@/lib/marketOverview/eurostat'

const obs = (values: number[], start = 2020) => values.map((value, i) => ({ period: `${start + i}`, value }))

describe('parser delle fonti', () => {
  test('FRED: salta intestazione e osservazioni mancanti (".")', () => {
    const csv = 'observation_date,DGS10\n2026-10-01,5.24\n2026-10-02,.\n2026-10-05,5.28\n'
    expect(parseFredCsv(csv)).toEqual([
      { period: '2026-10-01', value: 5.24 },
      { period: '2026-10-05', value: 5.28 },
    ])
  })
  test('FRED: risposta non CSV (pagina di errore) → nessuna osservazione', () => {
    expect(parseFredCsv('<html><body>Error</body></html>')).toEqual([])
  })
  test('Eurostat JSON-stat: ordina per periodo e ignora i buchi', () => {
    const json = {
      value: { '0': 2.9, '2': 3.8 },
      dimension: { time: { category: { index: { '2026-07': 0, '2026-08': 1, '2026-09': 2 } } } },
    }
    expect(parseJsonStatSeries(json)).toEqual([
      { period: '2026-07', value: 2.9 },
      { period: '2026-09', value: 3.8 },
    ])
  })
  test('Eurostat: struttura inattesa → []', () => {
    expect(parseJsonStatSeries({})).toEqual([])
  })
})

describe('helper sulle serie', () => {
  test('yoyFromLevels: variazione % sullo stesso periodo dell’anno prima', () => {
    const levels = obs([100, 101, 102, 103, 110])
    const yoy = yoyFromLevels(levels, 4)
    expect(yoy).toHaveLength(1)
    expect(yoy[0].value).toBeCloseTo(10)
  })
  test('direction rispetta la soglia di indifferenza', () => {
    expect(direction(obs([2.0, 2.1, 2.2]), 2, 0.3)).toBe('flat')
    expect(direction(obs([2.0, 2.5, 3.0]), 2, 0.3)).toBe('up')
    expect(direction(obs([3.0, 2.5, 2.0]), 2, 0.3)).toBe('down')
    expect(direction(obs([3.0]), 2, 0.3)).toBe('flat')
  })
  test('lagged: null se la serie è troppo corta', () => {
    expect(lagged(obs([1, 2, 3]), 2)?.value).toBe(1)
    expect(lagged(obs([1, 2, 3]), 3)).toBeNull()
  })
  test('lastRateChange trova l’ultimo gradino', () => {
    const s = [
      { period: '2025-06-10', value: 2.25 }, { period: '2025-06-11', value: 2 },
      { period: '2026-09-15', value: 2.25 }, { period: '2026-09-16', value: 2.5 }, { period: '2026-10-06', value: 2.5 },
    ]
    expect(lastRateChange(s)).toEqual({ date: '2026-09-16', from: 2.25, to: 2.5 })
    expect(lastRateChange(obs([2, 2, 2]))).toBeNull()
  })
  test('periodLabel copre mese, trimestre e giorno', () => {
    expect(periodLabel('2026-09')).toBe('set 2026')
    expect(periodLabel('2026-Q1')).toBe('T1 2026')
    expect(periodLabel('2026-10-05')).toBe('5 ott 2026')
  })
  test('delPct sceglie la preposizione giusta', () => {
    expect(delPct(3.8)).toBe('del 3,8%')
    expect(delPct(0.5)).toBe('dello 0,5%')
    expect(delPct(8.1)).toBe('dell’8,1%')
    expect(delPct(11)).toBe('dell’11,0%')
    expect(delPct(-1.2)).toBe('del 1,2%')
  })
})

describe('classificatori a soglie fisse', () => {
  test('inflazione rispetto all’obiettivo del 2%', () => {
    expect(classifyInflation(2.0, 'flat').tone).toBe('calm')
    expect(classifyInflation(3.8, 'up')).toEqual({ status: 'Sopra l’obiettivo del 2%, in aumento', tone: 'watch' })
    expect(classifyInflation(5, 'down').tone).toBe('alert')
    expect(classifyInflation(0.3, 'down').tone).toBe('watch')
  })
  test('politica monetaria: conta solo una mossa recente', () => {
    const now = new Date('2026-10-06T00:00:00Z')
    expect(classifyPolicy({ date: '2026-09-16', from: 2.25, to: 2.5 }, now).phase).toBe('hiking')
    expect(classifyPolicy({ date: '2026-03-01', from: 2.5, to: 2.25 }, now).phase).toBe('cutting')
    expect(classifyPolicy({ date: '2025-06-11', from: 2.25, to: 2 }, now).phase).toBe('hold')
    expect(classifyPolicy(null, now).phase).toBe('hold')
  })
  test('crescita: la regola di Sahm prevale sul PIL', () => {
    expect(classifyGrowth(1.5, 0.6).tone).toBe('alert')
    expect(classifyGrowth(-0.2, 0).tone).toBe('alert')
    expect(classifyGrowth(0.5, 0).status).toBe('Crescita debole')
    expect(classifyGrowth(1.5, null).tone).toBe('calm')
    expect(classifyGrowth(null, null).tone).toBe('watch')
  })
  test('stress: basta un indicatore oltre soglia', () => {
    expect(classifyStress(-0.8, 15.5).tone).toBe('calm')
    expect(classifyStress(-0.8, 24).tone).toBe('watch')
    expect(classifyStress(1.4, 18).tone).toBe('alert')
    expect(classifyStress(null, 35).tone).toBe('alert')
    expect(classifyStress(null, null).tone).toBe('watch')
  })
})
