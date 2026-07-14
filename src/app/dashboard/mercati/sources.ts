// src/app/dashboard/mercati/sources.ts — Link alle fonti dati, sullo stesso
// principio di tasse/sources.ts: ogni indicatore cita una fonte verificabile.
// La chiave è il valore del campo `source` del MarketSignal, così il link si
// deriva direttamente dal dato.

export interface MarketSource {
  label:     string
  href:      string
  /** true = fonte istituzionale (pallino dedicato). */
  official?: boolean
}

export const MARKET_SOURCES: Record<string, MarketSource> = {
  'Yahoo Finance': {
    label: 'Yahoo Finance',
    href:  'https://finance.yahoo.com/markets/',
  },
  'BCE (ECB Data Portal)': {
    label: 'BCE — Tassi d’interesse a lungo termine',
    href:  'https://data.ecb.europa.eu/data/data-categories/financial-markets-and-interest-rates/long-term-interest-rates',
    official: true,
  },
  'alternative.me': {
    label: 'alternative.me — Fear & Greed Index',
    href:  'https://alternative.me/crypto/fear-and-greed-index/',
  },
  'CoinGecko': {
    label: 'CoinGecko — Global charts',
    href:  'https://www.coingecko.com/en/global-charts',
  },
}

export function sourceFor(source: string): MarketSource | undefined {
  return MARKET_SOURCES[source]
}
