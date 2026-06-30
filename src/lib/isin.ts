// src/lib/isin.ts — ISIN lookup via OpenFIGI (Bloomberg, gratuito, no API key obbligatoria).
// Free tier: 25 req/min senza chiave; con OPENFIGI_KEY (account gratuito) il limite sale.

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

export async function lookupIsin(isin: string): Promise<IsinResult[]> {
  const normalized = isin.trim().toUpperCase()
  if (!/^[A-Z]{2}[A-Z0-9]{10}$/.test(normalized)) return []

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const key = process.env.OPENFIGI_KEY
  if (key) headers['X-OPENFIGI-APIKEY'] = key

  try {
    const res = await fetch('https://api.openfigi.com/v3/mapping', {
      method:  'POST',
      headers,
      body:    JSON.stringify([{ idType: 'ID_ISIN', idValue: normalized }]),
    })
    if (!res.ok) return []

    const json = await res.json() as [{ data?: FigiEntry[]; error?: string }]
    const entries = json[0]?.data ?? []

    // 1. Costruisci risultati solo per le borse presenti in EXCH_MAP
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

    // 2. Deduplicazione: stesso simbolo Yahoo = stessa listing, tieni il primo per priorità
    const seen = new Set<string>()
    const deduped = mapped
      .sort((a, b) => a._priority - b._priority)
      .filter((r) => {
        if (seen.has(r.yahooSymbol)) return false
        seen.add(r.yahooSymbol)
        return true
      })

    // 3. Rimuovi il campo interno e limita a 8 risultati
    return deduped.slice(0, 8).map(({ _priority: _, ...r }) => r)

  } catch {
    return []
  }
}
