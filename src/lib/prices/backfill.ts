// Backfill dello storico prezzi giornalieri su price_history.
// Per ogni strumento del portafoglio: scarica da Yahoo Finance dalla prima
// trade_date fino a oggi, salta le date già presenti (ON CONFLICT DO NOTHING).
import { sqlite } from '@/db'
import { getInstrument } from '@/lib/instruments'
import { appendPriceHistory } from '@/lib/priceHistory'
import { getHistoricalPricesRange } from './yahoo'

export interface BackfillResult {
  symbol:   string
  inserted: number
  error?:   string
}

export async function backfillInstrumentHistory(
  instrumentId: number,
  fromDate: string,  // ISO YYYY-MM-DD — prima data da scaricare
): Promise<BackfillResult> {
  const instrument = getInstrument(instrumentId)
  if (!instrument) return { symbol: '?', inserted: 0, error: 'strumento non trovato' }

  if (instrument.price_source !== 'yahoo') {
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

  const { points, currency } = await getHistoricalPricesRange(instrument.symbol, fromDate, today)
  const storeCurrency = currency ?? instrument.currency

  for (const p of points) {
    appendPriceHistory(
      instrumentId,
      p.date,
      p.close.toFixed(6).replace(/\.?0+$/, ''),
      storeCurrency,
      'yahoo',
    )
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
