// src/__tests__/lib/prices.test.ts — Price cache + TTL logic (mocked providers).
// Providers (yahoo/coingecko/alphavantage) are mocked at module level.
// Tests focus on: routing by price_source, TTL behaviour, stale fallback.
import { sqlite } from '@/db'

// ── Mock provider modules ─────────────────────────────────────────────────────
const mockYahooGetQuote      = jest.fn()
const mockCoingeckoGetQuote  = jest.fn()
const mockAlphaGetQuote      = jest.fn()

jest.mock('@/lib/prices/yahoo',       () => ({ yahooProvider:       { getQuote: mockYahooGetQuote      } }))
jest.mock('@/lib/prices/coingecko',   () => ({ coingeckoProvider:   { getQuote: mockCoingeckoGetQuote  } }))
jest.mock('@/lib/prices/alphavantage',() => ({ alphaVantageProvider:{ getQuote: mockAlphaGetQuote      } }))

// ── DB fixture ────────────────────────────────────────────────────────────────
let instrumentId: number

beforeAll(() => {
  sqlite
    .prepare(
      `INSERT INTO instruments (symbol, name, cluster, currency, price_source)
       VALUES ('TEST.DE', 'Test ETF', 'etf', 'EUR', 'yahoo')`,
    )
    .run()
  const row = sqlite.prepare("SELECT id FROM instruments WHERE symbol='TEST.DE'").get() as { id: number }
  instrumentId = row.id
})

afterAll(() => {
  sqlite.exec("DELETE FROM price_history WHERE instrument_id = (SELECT id FROM instruments WHERE symbol='TEST.DE')")
  sqlite.exec("DELETE FROM instruments WHERE symbol='TEST.DE'")
})

afterEach(() => {
  jest.clearAllMocks()
  sqlite.exec(`UPDATE instruments SET last_price = NULL, last_price_at = NULL, price_source = 'yahoo' WHERE id = ${instrumentId}`)
})

function getInstrumentRow() {
  return sqlite.prepare('SELECT * FROM instruments WHERE id = ?').get(instrumentId) as {
    id: number; symbol: string; name: string; cluster: string; currency: string;
    price_source: string; provider_symbol: string | null;
    last_price: string | null; last_price_at: number | null; isin: null; ter: null; created_at: number;
  }
}

// ── Routing by price_source ───────────────────────────────────────────────────
describe('resolveQuote — routing', () => {
  test('price_source=yahoo → calls Yahoo first', async () => {
    mockYahooGetQuote.mockResolvedValue({ price: '90.00', currency: 'EUR', asOf: 1_000_000 })
    const { resolveQuote } = await import('@/lib/prices/index')
    const q = await resolveQuote(getInstrumentRow() as never)
    expect(q?.price).toBe('90.00')
    expect(mockYahooGetQuote).toHaveBeenCalledTimes(1)
    expect(mockCoingeckoGetQuote).not.toHaveBeenCalled()
  })

  test('price_source=coingecko → calls CoinGecko first, Yahoo as fallback', async () => {
    sqlite.exec(`UPDATE instruments SET price_source = 'coingecko' WHERE id = ${instrumentId}`)
    mockCoingeckoGetQuote.mockResolvedValue({ price: '85000', currency: 'EUR', asOf: 1_000_000 })
    const { resolveQuote } = await import('@/lib/prices/index')
    const q = await resolveQuote(getInstrumentRow() as never)
    expect(q?.price).toBe('85000')
    expect(mockCoingeckoGetQuote).toHaveBeenCalledTimes(1)
    expect(mockYahooGetQuote).not.toHaveBeenCalled() // no fallback needed
  })

  test('price_source=manual → returns null without any network call', async () => {
    sqlite.exec(`UPDATE instruments SET price_source = 'manual' WHERE id = ${instrumentId}`)
    const { resolveQuote } = await import('@/lib/prices/index')
    const q = await resolveQuote(getInstrumentRow() as never)
    expect(q).toBeNull()
    expect(mockYahooGetQuote).not.toHaveBeenCalled()
    expect(mockCoingeckoGetQuote).not.toHaveBeenCalled()
  })

  test('Yahoo fails → falls back to CoinGecko for crypto', async () => {
    sqlite.exec(`UPDATE instruments SET cluster = 'crypto' WHERE id = ${instrumentId}`)
    mockYahooGetQuote.mockResolvedValue(null) // Yahoo returns nothing
    mockCoingeckoGetQuote.mockResolvedValue({ price: '85000', currency: 'EUR', asOf: 1_000_000 })
    const { resolveQuote } = await import('@/lib/prices/index')
    const q = await resolveQuote(getInstrumentRow() as never)
    expect(q?.price).toBe('85000')
    expect(mockCoingeckoGetQuote).toHaveBeenCalledTimes(1)
    // Restore
    sqlite.exec(`UPDATE instruments SET cluster = 'etf' WHERE id = ${instrumentId}`)
  })
})

// ── TTL logic ─────────────────────────────────────────────────────────────────
describe('refreshInstrumentPrice — TTL', () => {
  test('skips fetch if price is fresh (within TTL)', async () => {
    const nowEpoch = Math.floor(Date.now() / 1000)
    // 5 min ago = well within default 30min TTL
    sqlite.exec(`UPDATE instruments SET last_price = '90.00', last_price_at = ${nowEpoch - 300} WHERE id = ${instrumentId}`)

    const { refreshInstrumentPrice } = await import('@/lib/prices/index')
    const result = await refreshInstrumentPrice(getInstrumentRow() as never)
    expect(result.stale).toBe(false)
    expect(result.quote?.price).toBe('90.00')
    expect(mockYahooGetQuote).not.toHaveBeenCalled()
  })

  test('fetches if price is older than TTL', async () => {
    const oldEpoch = Math.floor(Date.now() / 1000) - 3600 // 1h ago
    sqlite.exec(`UPDATE instruments SET last_price = '88.00', last_price_at = ${oldEpoch} WHERE id = ${instrumentId}`)
    mockYahooGetQuote.mockResolvedValue({ price: '92.50', currency: 'EUR', asOf: Math.floor(Date.now() / 1000) })

    const { refreshInstrumentPrice } = await import('@/lib/prices/index')
    const result = await refreshInstrumentPrice(getInstrumentRow() as never)
    expect(result.stale).toBe(false)
    expect(result.quote?.price).toBe('92.50')
    expect(mockYahooGetQuote).toHaveBeenCalledTimes(1)
    // DB updated
    const updated = sqlite.prepare('SELECT last_price FROM instruments WHERE id = ?').get(instrumentId) as { last_price: string }
    expect(updated.last_price).toBe('92.50')
  })

  test('force=true always refetches even if fresh', async () => {
    const nowEpoch = Math.floor(Date.now() / 1000)
    sqlite.exec(`UPDATE instruments SET last_price = '90.00', last_price_at = ${nowEpoch - 60} WHERE id = ${instrumentId}`)
    mockYahooGetQuote.mockResolvedValue({ price: '95.00', currency: 'EUR', asOf: nowEpoch })

    const { refreshInstrumentPrice } = await import('@/lib/prices/index')
    const result = await refreshInstrumentPrice(getInstrumentRow() as never, { force: true })
    expect(result.quote?.price).toBe('95.00')
    expect(mockYahooGetQuote).toHaveBeenCalledTimes(1)
  })

  test('source down → returns stale last known price with stale=true', async () => {
    const oldEpoch = Math.floor(Date.now() / 1000) - 3600
    sqlite.exec(`UPDATE instruments SET last_price = '88.00', last_price_at = ${oldEpoch} WHERE id = ${instrumentId}`)
    mockYahooGetQuote.mockResolvedValue(null) // all providers fail

    const { refreshInstrumentPrice } = await import('@/lib/prices/index')
    const result = await refreshInstrumentPrice(getInstrumentRow() as never)
    expect(result.stale).toBe(true)
    expect(result.quote?.price).toBe('88.00')
  })

  test('no price at all + source down → stale=true, quote=null', async () => {
    // last_price is NULL (no historic price)
    mockYahooGetQuote.mockResolvedValue(null)
    const { refreshInstrumentPrice } = await import('@/lib/prices/index')
    const result = await refreshInstrumentPrice(getInstrumentRow() as never)
    expect(result.stale).toBe(true)
    expect(result.quote).toBeNull()
  })

  test('manual instrument: no fetch, returns null quote even with force', async () => {
    sqlite.exec(`UPDATE instruments SET price_source = 'manual' WHERE id = ${instrumentId}`)
    const { refreshInstrumentPrice } = await import('@/lib/prices/index')
    const result = await refreshInstrumentPrice(getInstrumentRow() as never, { force: true })
    expect(mockYahooGetQuote).not.toHaveBeenCalled()
    expect(result.quote).toBeNull()
  })
})

describe('data quality', () => {
  test('rejects currency mismatch and non-finite prices', async () => {
    const { resolveQuote } = await import('@/lib/prices/index')
    for (const quote of [
      { price: '100', currency: 'USD', asOf: 1000 },
      { price: 'NaN', currency: 'EUR', asOf: 1000 },
      { price: '100', currency: 'EUR', asOf: NaN },
    ]) {
      mockYahooGetQuote.mockResolvedValue(quote)
      expect(await resolveQuote(getInstrumentRow() as never)).toBeNull()
    }
  })
  test('fallback is attributed to the actual source, including cache', async () => {
    sqlite.prepare("UPDATE instruments SET price_source = 'alphavantage' WHERE id = ?").run(instrumentId)
    mockAlphaGetQuote.mockResolvedValue(null)
    mockYahooGetQuote.mockResolvedValue({ price: '99', currency: 'EUR', asOf: Math.floor(Date.now() / 1000) })
    const { refreshInstrumentPrice } = await import('@/lib/prices/index')
    expect((await refreshInstrumentPrice(getInstrumentRow() as never)).source).toBe('yahoo')
    expect((await refreshInstrumentPrice(getInstrumentRow() as never)).source).toBe('yahoo')
  })
  test('old observations remain stale and keep their own date', async () => {
    const asOf = Math.floor(Date.now() / 1000) - 86400 * 3
    mockYahooGetQuote.mockResolvedValue({ price: '91', currency: 'EUR', asOf })
    const { refreshInstrumentPrice } = await import('@/lib/prices/index')
    expect((await refreshInstrumentPrice(getInstrumentRow() as never)).stale).toBe(true)
    expect(sqlite.prepare('SELECT observed_at FROM price_observations WHERE instrument_id = ? AND price = ?').get(instrumentId, '91'))
      .toEqual({ observed_at: asOf })
    expect(sqlite.prepare('SELECT 1 FROM price_history WHERE instrument_id = ?').get(instrumentId)).toBeUndefined()
  })
  test('an older response cannot replace a newer cached observation', async () => {
    const now = Math.floor(Date.now() / 1000)
    sqlite.prepare('UPDATE instruments SET last_price = ?, last_price_at = ? WHERE id = ?').run('101', now, instrumentId)
    mockYahooGetQuote.mockResolvedValue({ price: '90', currency: 'EUR', asOf: now - 86400 })
    const { refreshInstrumentPrice } = await import('@/lib/prices/index')
    expect((await refreshInstrumentPrice(getInstrumentRow() as never, { force: true })).quote?.price).toBe('101')
  })
  test('a delayed concurrent request cannot roll back a newer observation', async () => {
    const now = Math.floor(Date.now() / 1000)
    let finish!: (quote: { price: string; currency: string; asOf: number }) => void
    mockYahooGetQuote.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
      .mockResolvedValueOnce({ price: '102', currency: 'EUR', asOf: now })
    const { refreshInstrumentPrice } = await import('@/lib/prices/index')
    const oldInstrument = getInstrumentRow()
    const slow = refreshInstrumentPrice(oldInstrument as never, { force: true })
    await refreshInstrumentPrice(oldInstrument as never, { force: true })
    finish({ price: '99', currency: 'EUR', asOf: now - 120 })
    expect((await slow).quote?.price).toBe('102')
    expect(getInstrumentRow().last_price).toBe('102')
  })

})
