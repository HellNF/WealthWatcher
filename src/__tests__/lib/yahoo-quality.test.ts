const mockQuote = jest.fn()
const mockChart = jest.fn()
jest.mock('yahoo-finance2', () => ({ __esModule: true, default: jest.fn().mockImplementation(() => ({ quote: mockQuote, chart: mockChart })) }))
import { yahooProvider, getHistoricalPrices, getAdjustedCloses, getHistoricalPricesRange } from '@/lib/prices/yahoo'
beforeEach(() => jest.clearAllMocks())
test('quote uses observation timestamp and normalizes pence', async () => {
  mockQuote.mockResolvedValue({ regularMarketPrice: 12345, currency: 'GBp', regularMarketTime: new Date('2026-01-02T16:30:00Z') })
  expect(await yahooProvider.getQuote('TEST.L')).toEqual({ price: '123.45', currency: 'GBP', asOf: Date.parse('2026-01-02T16:30:00Z') / 1000 })
})
test('undated quote is not labelled fresh', async () => {
  mockQuote.mockResolvedValue({ regularMarketPrice: 10, currency: 'EUR' })
  expect(await yahooProvider.getQuote('TEST')).toBeNull()
})
test('ETF with missing adjusted close cannot claim total-return history', async () => {
  mockChart.mockResolvedValue({ meta: { currency: 'EUR', instrumentType: 'ETF' }, quotes: [{ date: new Date(), close: 10 }] })
  expect((await getAdjustedCloses('TEST', '2025-01-01')).points).toEqual([])
})
test('price indices can use close; ETF adjusted prices normalize pence', async () => {
  mockChart.mockResolvedValue({ meta: { currency: 'GBp', instrumentType: 'ETF' }, quotes: [{ date: new Date('2026-01-02'), close: 1200, adjclose: 1100 }] })
  expect(await getAdjustedCloses('TEST.L', '2025-01-01')).toEqual({ currency: 'GBP', points: [{ date: '2026-01-02', close: 11 }] })
  mockChart.mockResolvedValue({ meta: { currency: 'USD', instrumentType: 'INDEX' }, quotes: [{ date: new Date('2026-01-02'), close: 100 }] })
  expect((await getAdjustedCloses('^TEST', '2025-01-01')).points[0].close).toBe(100)
})
test('unknown history units cannot fall back to instrument currency', async () => {
  mockQuote.mockRejectedValue(new Error('unavailable'))
  expect(await getHistoricalPricesRange('TEST.L', '2025-01-01', '2026-01-01')).toEqual({ points: [], currency: null })
})

test('chart prices use normalized units consistently with live quotes', async () => {
  mockChart.mockResolvedValue({ meta: { currency: 'GBp' }, quotes: [{ date: new Date('2026-01-02'), close: 1200 }] })
  expect(await getHistoricalPrices('TEST.L', '1m')).toEqual([{ date: '2026-01-02', close: 12 }])
})

