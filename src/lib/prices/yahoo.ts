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
