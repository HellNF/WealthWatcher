// Backfill dello storico prezzi giornalieri su price_history.
// Per ogni strumento del portafoglio: scarica da Yahoo Finance (o CoinGecko per le crypto)
// dalla prima trade_date fino a oggi, salta le date già presenti (ON CONFLICT DO NOTHING).
import { sqlite } from '@/db'
import { getInstrument } from '@/lib/instruments'
import { appendPriceHistory } from '@/lib/priceHistory'
import { getHistoricalPricesRange, type PricePoint } from './yahoo'
import { COINGECKO_MAX_DAYS, getCoinHistory } from './coingecko'
import { getCoinHistoryCMC } from './coinmarketcap'
import { matchesReferencePrice, yahooCryptoTicker } from '.'

export interface BackfillResult {
  symbol:   string
  inserted: number
  error?:   string
}

async function backfillInstrumentHistory(
  instrumentId: number,
  fromDate: string,  // ISO YYYY-MM-DD — prima data da scaricare
): Promise<BackfillResult> {
  const instrument = getInstrument(instrumentId)
  if (!instrument) return { symbol: '?', inserted: 0, error: 'strumento non trovato' }

  if (instrument.price_source !== 'yahoo' && instrument.price_source !== 'coingecko') {
    return {
      symbol:  instrument.symbol,
      inserted: 0,
      error:   `fonte "${instrument.price_source}" non supportata per il backfill automatico`,
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  const before = (
    sqlite
      .prepare('SELECT COUNT(*) as n FROM price_history WHERE instrument_id = ?')
      .get(instrumentId) as { n: number }
  ).n

  if (instrument.price_source === 'coingecko') {
    // CoinGecko gratuito copre solo l'ultimo anno: per date più vecchie la fonte
    // giornaliera è Yahoo (SYM-EUR), con CoinGecko a un anno come ripiego.
    if (instrument.currency !== 'EUR') return { symbol: instrument.symbol, inserted: 0, error: 'Valuta dello storico diversa dallo strumento' }
    const coinId = (instrument.provider_symbol ?? instrument.symbol).toLowerCase()
    const refPrice = instrument.last_price ? Number(instrument.last_price) : null
    const daysBack = (Date.now() - Date.parse(fromDate)) / 86_400_000
    let points: PricePoint[] = []
    let source = 'yahoo'
    if (daysBack <= COINGECKO_MAX_DAYS - 5) {
      points = await getCoinHistory(coinId, '1y')
      source = 'coingecko'
      if (points.length === 0) { points = await getCoinHistoryCMC(instrument.symbol, '1y'); source = 'coinmarketcap' }
    }
    // Storico più lungo di un anno, oppure CoinGecko/CMC non disponibili (es. limite di
    // richieste): serie giornaliera Yahoo.
    if (points.length === 0) {
      const yahoo = await getHistoricalPricesRange(yahooCryptoTicker(instrument.symbol), fromDate, today)
      if (yahoo.currency === 'EUR' && matchesReferencePrice(yahoo.points, refPrice)) { points = yahoo.points; source = 'yahoo' }
    }
    if (points.length === 0) return { symbol: instrument.symbol, inserted: 0, error: 'Nessuna fonte ha restituito lo storico' }
    for (const p of points) {
      if (p.date < fromDate || p.date >= today || !Number.isFinite(p.close) || p.close <= 0) continue
      appendPriceHistory(
        instrumentId,
        p.date,
        p.close.toFixed(8).replace(/\.?0+$/, ''),
        'EUR',
        source,
        'daily-reference',
      )
    }
  } else {
    const { points, currency } = await getHistoricalPricesRange(instrument.symbol, fromDate, today)
    if (!currency || currency !== instrument.currency) return { symbol: instrument.symbol, inserted: 0, error: 'Valuta dello storico non verificata' }
    const storeCurrency = currency

    for (const p of points) {
      if (p.date >= today || !Number.isFinite(p.close) || p.close <= 0) continue
      appendPriceHistory(
        instrumentId,
        p.date,
        p.close.toFixed(6).replace(/\.?0+$/, ''),
        storeCurrency,
        'yahoo',
      )
    }
  }

  const after = (
    sqlite
      .prepare('SELECT COUNT(*) as n FROM price_history WHERE instrument_id = ?')
      .get(instrumentId) as { n: number }
  ).n

  return { symbol: instrument.symbol, inserted: after - before }
}

export async function backfillPortfolioHistory(
  userId:      number,
  portfolioId: number,
): Promise<BackfillResult[]> {
  const rows = sqlite
    .prepare(
      `SELECT instrument_id, MIN(trade_date) AS from_date
       FROM investment_txns
       WHERE owner_id = ? AND portfolio_id = ?
       GROUP BY instrument_id`,
    )
    .all(userId, portfolioId) as Array<{ instrument_id: number; from_date: string }>

  const results: BackfillResult[] = []
  for (const row of rows) {
    results.push(await backfillInstrumentHistory(row.instrument_id, row.from_date))
  }
  return results
}
