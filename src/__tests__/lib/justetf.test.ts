import { parseEtfData, validIsin, refreshEtf, getCachedEtf } from '@/lib/prices/justetf'
import { sqlite } from '@/db'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'
jest.mock('@/lib/fetchWithTimeout', () => ({ fetchWithTimeout: jest.fn() }))
const network = jest.mocked(fetchWithTimeout)
const isin = 'IE00B4L5Y983'
const cards = { etfs: [{ entityType: 'ETF', isin, name: 'World ETF', ter: { raw: 0.2 }, icons: [{ name: 'acc' }, { name: 'phy' }] }] }
const series = { series: [{ date: '2026-11-08', value: { raw: 0 } }, { date: '2026-11-09', value: { raw: 1.5 } }] }
const parse = (c: unknown = cards, s: unknown = series) => parseEtfData(isin, c, s, '2026-11-08', '2026-11-09', 100)
afterEach(() => { network.mockReset(); jest.useRealTimers(); sqlite.prepare('DELETE FROM etf_profiles').run() })
test('ISIN includes the checksum, not only the shape', () => {
  expect(validIsin(isin)).toBe(true)
  expect(validIsin('IE00BK5BQT80')).toBe(true)
  expect(validIsin('IE00B4L5Y984')).toBe(false)
  expect(validIsin('../../test')).toBe(false)
})
test('TER is a percentage; returns are separated from prices and labelled', () => {
  expect(parse()).toMatchObject({ terPercent: 0.2, currency: 'EUR', includesDividends: true, distribution: 'Accumulazione', replication: 'Fisica', performance: [{ date: '2026-11-08', percent: 0 }, { date: '2026-11-09', percent: 1.5 }] })
})
test('unknown metadata stays unknown', () => {
  expect(parse({ etfs: [{ ...cards.etfs[0], ter: undefined, icons: [{ name: 'unknown' }] }] })).toMatchObject({ terPercent: null, distribution: null, replication: null })
})
test('wrong ISIN and incomplete or malformed performance fail closed', () => {
  expect(() => parse({ etfs: [{ ...cards.etfs[0], isin: 'IE00B5BMR087' }] })).toThrow()
  for (const bad of [[], [...series.series].reverse(), [series.series[0], series.series[0]], [series.series[0], { date: '2026-11-10', value: { raw: 4 } }], [series.series[0], { date: '2026-11-09', value: { raw: null } }]]) {
    expect(() => parse(cards, { series: bad })).toThrow()
  }
  expect(() => parse(cards, { series: [{ date: '2026-11-08', value: { raw: 123 } }, series.series[1]] })).toThrow()
})
test('explicit refresh caches validated data; outage preserves the last good copy', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-10T12:00:00Z'))
  network.mockResolvedValueOnce({ ok: true, json: async () => cards } as Response)
    .mockResolvedValueOnce({ ok: true, json: async () => series } as Response)
  const profile = await refreshEtf(isin)
  expect(await refreshEtf(isin)).toEqual(profile)
  expect(network).toHaveBeenCalledTimes(2)
  expect(sqlite.prepare("SELECT 1 FROM instruments WHERE isin = ?").get(isin)).toBeUndefined()
  jest.setSystemTime(new Date('2026-11-12T12:00:00Z'))
  network.mockRejectedValue(new Error('offline'))
  await expect(refreshEtf(isin)).rejects.toThrow()
  expect(getCachedEtf(isin)).toEqual(profile)
})
