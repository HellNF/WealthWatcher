// src/lib/isin.ts — ISIN lookup.
// Strategia: prima OpenFIGI (Bloomberg, gratuito) per ETF/azioni con i loro
// listing di borsa; se non produce risultati utilizzabili (es. fondi comuni, o
// borse non mappate), fallback su Yahoo search che risolve l'ISIN direttamente
// nel simbolo Yahoo (anche per i fondi, es. LU… → "0P…").
import { searchYahoo } from '@/lib/prices/yahoo'

export interface IsinResult {
  figi:        string
  name:        string
  ticker:      string       // ticker specifico per la borsa
  exchCode:    string       // codice borsa OpenFIGI (es. "GY" = Xetra)
  exchLabel:   string       // etichetta leggibile (es. "Xetra")
  yahooSymbol: string       // simbolo costruito per Yahoo Finance (ticker + suffisso)
  cluster:     'etf' | 'bond' | 'stock' | 'crypto' | 'other'
  priceSource: 'yahoo' | 'coingecko' | 'alphavantage' | 'manual'
}

// OpenFIGI exchCode → suffisso Yahoo Finance + etichetta + priorità (più basso = prima)
// Le borse non presenti qui vengono filtrate (troppo esotiche o non supportate da Yahoo).
const EXCH_MAP: Record<string, { suffix: string; label: string; priority: number }> = {
  IM: { suffix: '.MI', label: 'Borsa Italiana (Milano)',  priority: 1 },
  GY: { suffix: '.DE', label: 'Xetra (Francoforte)',     priority: 2 },
  NA: { suffix: '.AS', label: 'Euronext Amsterdam',       priority: 3 },
  FP: { suffix: '.PA', label: 'Euronext Parigi',          priority: 4 },
  LN: { suffix: '.L',  label: 'London Stock Exchange',    priority: 5 },
  SM: { suffix: '.MC', label: 'Borsa Madrid',             priority: 6 },
  SW: { suffix: '.SW', label: 'SIX Swiss Exchange',       priority: 7 },
  BB: { suffix: '.BR', label: 'Euronext Bruxelles',       priority: 8 },
  UN: { suffix: '',    label: 'NYSE',                     priority: 9 },
  UQ: { suffix: '',    label: 'NASDAQ',                   priority: 10 },
  UA: { suffix: '',    label: 'AMEX',                     priority: 11 },
  US: { suffix: '',    label: 'USA (generico)',            priority: 12 },
  HK: { suffix: '.HK', label: 'Hong Kong',                priority: 13 },
  AU: { suffix: '.AX', label: 'ASX (Australia)',          priority: 14 },
  JT: { suffix: '.T',  label: 'Tokyo',                   priority: 15 },
}

function toCluster(secType: string, secType2 = ''): IsinResult['cluster'] {
  const t = (secType + ' ' + secType2).toLowerCase()
  if (t.match(/etf|etp|fund/))                        return 'etf'
  if (t.match(/bond|bill|note|govt|government|corp/)) return 'bond'
  if (t.match(/common|ordinary|equity|cs|stock/))     return 'stock'
  return 'other'
}

interface FigiEntry {
  figi:           string
  name:           string
  ticker:         string
  exchCode:       string
  securityType:   string
  securityType2?: string
}

// quoteType Yahoo → cluster interno. I fondi comuni sono tassati come i fondi
// (26%), quindi mappati su 'etf' (fondo) per coerenza fiscale/di display.
function quoteTypeToCluster(qt: string): IsinResult['cluster'] {
  switch (qt.toUpperCase()) {
    case 'ETF':
    case 'MUTUALFUND':      return 'etf'
    case 'EQUITY':          return 'stock'
    case 'CRYPTOCURRENCY':  return 'crypto'
    case 'BOND':            return 'bond'
    default:                return 'other'
  }
}

async function openFigiLookup(isin: string): Promise<IsinResult[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = process.env.OPENFIGI_KEY
  if (key) headers['X-OPENFIGI-APIKEY'] = key

  try {
    const res = await fetch('https://api.openfigi.com/v3/mapping', {
      method:  'POST',
      headers,
      body:    JSON.stringify([{ idType: 'ID_ISIN', idValue: isin }]),
    })
    if (!res.ok) {
      console.error('[isin] OpenFIGI HTTP', res.status, await res.text().catch(() => ''))
      return []
    }

    const json = await res.json() as [{ data?: FigiEntry[]; error?: string }]
    const entries = json[0]?.data ?? []

    // Costruisci risultati solo per le borse presenti in EXCH_MAP
    const mapped = entries
      .filter((e) => e.ticker && e.exchCode && e.exchCode in EXCH_MAP)
      .map((e) => {
        const exch = EXCH_MAP[e.exchCode]
        return {
          figi:        e.figi,
          name:        e.name,
          ticker:      e.ticker,
          exchCode:    e.exchCode,
          exchLabel:   exch.label,
          yahooSymbol: (e.ticker + exch.suffix).toUpperCase(),
          cluster:     toCluster(e.securityType, e.securityType2),
          priceSource: 'yahoo' as const,
          _priority:   exch.priority,
        }
      })

    // Deduplicazione: stesso simbolo Yahoo = stessa listing, tieni il primo per priorità
    const seen = new Set<string>()
    const deduped = mapped
      .sort((a, b) => a._priority - b._priority)
      .filter((r) => {
        if (seen.has(r.yahooSymbol)) return false
        seen.add(r.yahooSymbol)
        return true
      })

    return deduped.slice(0, 8).map(({ _priority: _, ...r }) => r)
  } catch (e) {
    console.error('[isin] OpenFIGI errore', e)
    return []
  }
}

async function yahooIsinFallback(isin: string): Promise<IsinResult[]> {
  const hits = await searchYahoo(isin)
  const seen = new Set<string>()
  const out: IsinResult[] = []
  for (const h of hits) {
    if (seen.has(h.symbol)) continue
    seen.add(h.symbol)
    out.push({
      figi:        '',
      name:        h.name,
      ticker:      h.symbol,
      exchCode:    h.exchange,
      exchLabel:   h.exchange || 'Yahoo Finance',
      yahooSymbol: h.symbol,
      cluster:     quoteTypeToCluster(h.quoteType),
      priceSource: 'yahoo',
    })
  }
  return out.slice(0, 8)
}

export async function lookupIsin(isin: string): Promise<IsinResult[]> {
  const normalized = isin.trim().toUpperCase()
  if (!/^[A-Z]{2}[A-Z0-9]{10}$/.test(normalized)) return []

  const figiResults = await openFigiLookup(normalized)
  if (figiResults.length > 0) return figiResults

  // Fallback: fondi comuni e borse non mappate da OpenFIGI.
  return yahooIsinFallback(normalized)
}
