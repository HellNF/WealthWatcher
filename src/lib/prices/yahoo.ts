// src/lib/prices/yahoo.ts — yahoo-finance2 v3 adapter.
// Primary provider: covers ETF, stocks, crypto, FX pairs (unofficial, no API key).
// SPEC §6.1 risk: wrapped behind PriceProvider so it's replaceable without
// touching the domain.
//
// yahoo-finance2 v3 breaking change: non si può chiamare yf.quote() direttamente
// sull'import; bisogna istanziare la classe con `new YahooFinance()`.
// yfInstance è un singleton lazy per non reimportare il modulo ad ogni chiamata.
import type { PriceProvider, Quote } from './provider'

// Istanza singleton — inizializzata al primo uso (dynamic import rimane server-side).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let yfInstance: any = null

async function getYf() {
  if (!yfInstance) {
    const mod = await import('yahoo-finance2')
    const YahooFinance = mod.default
    yfInstance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })
  }
  return yfInstance
}

export interface YahooSearchHit {
  symbol:    string
  name:      string
  exchange:  string
  quoteType: string   // EQUITY | ETF | MUTUALFUND | CRYPTOCURRENCY | …
}

// Ricerca simboli Yahoo per query libera (nome, ticker o ISIN). Risolve anche i
// fondi comuni (es. ISIN LU… → simbolo "0P…") che OpenFIGI non mappa su Yahoo.
export async function searchYahoo(query: string): Promise<YahooSearchHit[]> {
  try {
    const yf = await getYf()
    const r = await yf.search(query, { quotesCount: 10, newsCount: 0 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (r?.quotes ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((q: any) => q.symbol && q.quoteType)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((q: any) => ({
        symbol:    q.symbol as string,
        name:      (q.longname || q.shortname || q.symbol) as string,
        exchange:  (q.exchange ?? '') as string,
        quoteType: q.quoteType as string,
      }))
  } catch (e) {
    console.error('[yahoo] searchYahoo', query, e)
    return []
  }
}

// Yahoo Finance restituisce alcuni prezzi in subunità (es. azioni LSE in GBp = pence).
// Normalizza: GBp → GBP /100, ILA → ILS /100, ZAc → ZAR /100.
const SUBUNIT_MAP: Record<string, { major: string; factor: number }> = {
  GBp: { major: 'GBP', factor: 100 },
  ILA: { major: 'ILS', factor: 100 },
  ZAc: { major: 'ZAR', factor: 100 },
}

function normalizeCurrencyAndPrice(
  rawCurrency: string,
  rawPrice:    number,
): { price: number; currency: string } {
  const sub = SUBUNIT_MAP[rawCurrency]
  if (sub) return { price: rawPrice / sub.factor, currency: sub.major }
  return { price: rawPrice, currency: rawCurrency.toUpperCase() }
}

export const yahooProvider: PriceProvider = {
  async getQuote(symbol: string): Promise<Quote | null> {
    try {
      const yf     = await getYf()
      const result = await yf.quote(symbol)
      const price    = result?.regularMarketPrice as number | undefined
      const currency = result?.currency as string | undefined
      if (!price || !currency) return null

      const norm = normalizeCurrencyAndPrice(currency, price)
      return {
        price:    norm.price.toFixed(6).replace(/\.?0+$/, ''),
        currency: norm.currency,
        asOf:     Math.floor(Date.now() / 1000),
      }
    } catch {
      return null
    }
  },
}

export interface InstrumentDetails {
  price:    string | null   // prezzo corrente come stringa decimale
  currency: string | null
  ter:      string | null   // TER annuo come percentuale, es. "0.2" (= 0.20%)
}

export interface PricePoint {
  date:  string   // ISO date YYYY-MM-DD
  close: number   // prezzo di chiusura nella valuta dell'strumento
}

/**
 * Recupera dati storici (OHLC giornalieri o settimanali) da Yahoo Finance.
 * Periodi: 1m, 3m, 6m (giornaliero); 1y, 5y (settimanale).
 * Non lancia mai eccezioni — ritorna array vuoto in caso di errore.
 */
export async function getHistoricalPrices(
  symbol: string,
  period: '1m' | '3m' | '6m' | '1y' | '5y',
): Promise<PricePoint[]> {
  const now = Date.now()
  const days: Record<string, number> = { '1m': 30, '3m': 90, '6m': 180, '1y': 365, '5y': 1825 }
  const interval = period === '1y' || period === '5y' ? '1wk' : '1d'
  const period1 = new Date(now - days[period] * 86400000).toISOString().slice(0, 10)
  const period2 = new Date(now).toISOString().slice(0, 10)

  try {
    const yf = await getYf()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await yf.historical(symbol, { period1, period2, interval })
    return rows
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((r: any) => r.close != null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => ({
        date:  new Date(r.date).toISOString().slice(0, 10),
        close: r.close as number,
      }))
  } catch (e) {
    console.error('[yahoo] getHistoricalPrices', symbol, period, e)
    return []
  }
}

export interface HistoricalRangeResult {
  points:   PricePoint[]
  currency: string | null  // valuta normalizzata (es. GBP, non GBp)
}

/**
 * Recupera prezzi giornalieri per un intervallo di date arbitrario.
 * Applica la stessa normalizzazione subunit di getQuote (GBp→GBP /100).
 * Usata per il backfill dello storico prezzi su price_history.
 * Non lancia mai eccezioni — ritorna array vuoto in caso di errore.
 */
export async function getHistoricalPricesRange(
  symbol:   string,
  fromDate: string,  // ISO YYYY-MM-DD incluso
  toDate:   string,  // ISO YYYY-MM-DD incluso
): Promise<HistoricalRangeResult> {
  try {
    const yf = await getYf()

    // Ottieni valuta raw per determinare il fattore di normalizzazione
    let factor   = 1
    let currency: string | null = null
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = await yf.quote(symbol) as any
      if (q?.currency) {
        const sub = SUBUNIT_MAP[q.currency as string]
        if (sub) {
          factor   = 1 / sub.factor
          currency = sub.major
        } else {
          currency = (q.currency as string).toUpperCase()
        }
      }
    } catch { /* non critico: factor resta 1 */ }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await yf.historical(symbol, {
      period1:  fromDate,
      period2:  toDate,
      interval: '1d',
    })

    const points: PricePoint[] = rows
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((r: any) => r.close != null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => ({
        date:  new Date(r.date).toISOString().slice(0, 10),
        close: (r.close as number) * factor,
      }))

    return { points, currency }
  } catch (e) {
    console.error('[yahoo] getHistoricalPricesRange', symbol, fromDate, toDate, e)
    return { points: [], currency: null }
  }
}

/**
 * Recupera prezzo corrente + TER per un simbolo Yahoo Finance.
 * Non lancia mai eccezioni — ritorna null sui campi non disponibili.
 */
export async function getInstrumentDetails(symbol: string): Promise<InstrumentDetails> {
  let price:    string | null = null
  let currency: string | null = null
  let ter:      string | null = null

  try {
    const yf = await getYf()

    // Strategia 1: quote() — funziona per ETF, azioni, crypto
    try {
      const q = await yf.quote(symbol)
      if (q?.regularMarketPrice && q?.currency) {
        const norm = normalizeCurrencyAndPrice(q.currency as string, q.regularMarketPrice as number)
        price    = norm.price.toFixed(6).replace(/\.?0+$/, '')
        currency = norm.currency
      }
    } catch { /* quote() non disponibile per questo ticker */ }

    // Strategia 2: quoteSummary[price] — necessario per fondi comuni (ticker 0P...)
    // dove quote() restituisce regularMarketPrice null/0
    if (!price) {
      try {
        const summary = await yf.quoteSummary(symbol, { modules: ['price'] })
        const p = summary?.price
        if (p?.regularMarketPrice && p?.currency) {
          const norm = normalizeCurrencyAndPrice(p.currency as string, p.regularMarketPrice as number)
          price    = norm.price.toFixed(6).replace(/\.?0+$/, '')
          currency = norm.currency
        }
      } catch { /* anche quoteSummary[price] fallito */ }
    }

    // TER via fundProfile (ETF e fondi comuni)
    // In yahoo-finance2 v3: il TER è in fundProfile.feesExpensesInvestment.annualReportExpenseRatio
    try {
      const summary = await yf.quoteSummary(symbol, { modules: ['fundProfile'] })
      const fee = summary?.fundProfile?.feesExpensesInvestment
      if (fee?.annualReportExpenseRatio != null) {
        // Yahoo restituisce decimale (0.002 = 0.20%) → convertiamo in percentuale
        ter = (fee.annualReportExpenseRatio * 100).toFixed(4).replace(/\.?0+$/, '')
      }
    } catch { /* non è un fondo o campo non disponibile */ }

  } catch { /* provider down o simbolo non valido */ }

  return { price, currency, ter }
}
