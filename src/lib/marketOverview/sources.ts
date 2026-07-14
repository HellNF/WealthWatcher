// src/lib/marketOverview/sources.ts — Aggregatore di tutti gli adapter di
// mercato. Usato dal job scripts/market-refresh.ts per popolare la cache.
// Ogni sotto-adapter è resiliente (ritorna [] o filtra i null su errore), così
// il fallimento di una fonte non impedisce alle altre di aggiornarsi.
import { getEquitySignals } from './equities'
import { getBondSignals } from './bonds'
import { getCommoditySignals } from './commodities'
import { getCryptoSignals } from './crypto'
import type { MarketSignal } from './signals'

export interface MarketSignalGroup {
  key:     'equities' | 'bonds' | 'commodities' | 'crypto'
  title:   string
  signals: MarketSignal[]
}

/**
 * Recupera tutti i segnali di mercato dalle fonti esterne, raggruppati per
 * classe di asset. Le classi vengono interrogate in parallelo.
 */
export async function fetchAllMarketSignals(): Promise<MarketSignalGroup[]> {
  const [equities, bonds, commodities, crypto] = await Promise.all([
    getEquitySignals(),
    getBondSignals(),
    getCommoditySignals(),
    getCryptoSignals(),
  ])

  return [
    { key: 'equities',    title: 'Azionario',    signals: equities },
    { key: 'bonds',       title: 'Obbligazionario', signals: bonds },
    { key: 'commodities', title: 'Materie prime', signals: commodities },
    { key: 'crypto',      title: 'Criptovalute',  signals: crypto },
  ]
}

/** Versione appiattita per la scrittura in cache. */
export async function fetchAllMarketSignalsFlat(): Promise<MarketSignal[]> {
  const groups = await fetchAllMarketSignals()
  return groups.flatMap((g) => g.signals)
}
