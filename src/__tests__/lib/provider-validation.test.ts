import { fetchWithTimeout } from '@/lib/fetchWithTimeout'
import { fetchRateSnapshot } from '@/lib/fx/frankfurter'
import { alphaVantageProvider } from '@/lib/prices/alphavantage'
jest.mock('@/lib/fetchWithTimeout', () => ({ fetchWithTimeout: jest.fn() }))
const network = jest.mocked(fetchWithTimeout)
const json = (data: unknown) => new Response(JSON.stringify(data))
beforeEach(() => network.mockReset())
test.each([
  { date: '2024-01-02', base: 'USD', rates: { USD: 1 } },
  { date: '2024-01-03', base: 'EUR', rates: { USD: 1 } },
  { date: '2024-01-02', base: 'EUR', rates: { USD: -1 } },
  { date: '2024-01-02', base: 'EUR', rates: { USD: '1.2' } },
])('rejects FX with wrong base, future date or invalid rate: %j', async (data) => {
  network.mockResolvedValue(json(data))
  expect(await fetchRateSnapshot('2024-01-02')).toBeNull()
})
test('keeps actual date for previous business day', async () => {
  const data = { date: '2024-01-05', base: 'EUR', rates: { USD: 1.1 } }
  network.mockResolvedValue(json(data))
  expect(await fetchRateSnapshot('2024-01-07')).toEqual(data)
})
test('Alpha Vantage verifies currency and uses trading day', async () => {
  const previous = process.env.ALPHA_VANTAGE_KEY
  process.env.ALPHA_VANTAGE_KEY = 'test-only'
  try {
    network.mockResolvedValueOnce(json({ bestMatches: [{ '1. symbol': 'QUALITY.EUR', '8. currency': 'EUR' }] }))
      .mockResolvedValueOnce(json({ 'Global Quote': { '05. price': '45', '07. latest trading day': '2024-01-05' } }))
    expect(await alphaVantageProvider.getQuote('QUALITY.EUR')).toEqual({ price: '45', currency: 'EUR', kind: 'close', asOf: Date.parse('2024-01-05T00:00:00Z') / 1000 })
  } finally {
    if (previous === undefined) delete process.env.ALPHA_VANTAGE_KEY
    else process.env.ALPHA_VANTAGE_KEY = previous
  }
})
