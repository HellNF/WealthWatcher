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

// OpenFIGI exchCode → suffisso Yahoo Finance + etichetta leggibile
const EXCH_MAP: Record<string, { suffix: string; label: string }> = {
  GY: { suffix: '.DE', label: 'Xetra (DE)'    },
  LN: { suffix: '.L',  label: 'London (UK)'   },
  FP: { suffix: '.PA', label: 'Euronext Paris' },
  IM: { suffix: '.MI', label: 'Milano (IT)'   },
  SM: { suffix: '.MC', label: 'Madrid (ES)'   },
  SW: { suffix: '.SW', label: 'Swiss (CH)'    },
  NA: { suffix: '.AS', label: 'Amsterdam (NL)'},
  BB: { suffix: '.BR', label: 'Brussels (BE)' },
  HK: { suffix: '.HK', label: 'Hong Kong'     },
  AU: { suffix: '.AX', label: 'ASX (AU)'      },
  JT: { suffix: '.T',  label: 'Tokyo (JP)'    },
  UN: { suffix: '',    label: 'NYSE (US)'      },
  UQ: { suffix: '',    label: 'NASDAQ (US)'    },
  UA: { suffix: '',    label: 'AMEX (US)'      },
  US: { suffix: '',    label: 'USA'            },
}

function toCluster(secType: string, secType2 = ''): IsinResult['cluster'] {
  const t = (secType + ' ' + secType2).toLowerCase()
  if (t.match(/etf|etp|fund/))                        return 'etf'
  if (t.match(/bond|bill|note|govt|government|corp/)) return 'bond'
  if (t.match(/common|ordinary|equity|cs|stock/))     return 'stock'
  return 'other'
}

interface FigiEntry {
  figi:          string
  name:          string
  ticker:        string
  exchCode:      string
  securityType:  string
  securityType2?: string
}

export async function lookupIsin(isin: string): Promise<IsinResult[]> {
  const normalized = isin.trim().toUpperCase()
  // Basic ISIN format check (2 letters + 10 alphanumeric)
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

    return entries
      .filter((e) => e.ticker && e.exchCode)
      .map((e) => {
        const exch = EXCH_MAP[e.exchCode] ?? { suffix: '', label: e.exchCode }
        return {
          figi:        e.figi,
          name:        e.name,
          ticker:      e.ticker,
          exchCode:    e.exchCode,
          exchLabel:   exch.label,
          yahooSymbol: (e.ticker + exch.suffix).toUpperCase(),
          cluster:     toCluster(e.securityType, e.securityType2),
          priceSource: 'yahoo' as const,
        }
      })
  } catch {
    return []
  }
}
