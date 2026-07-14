// src/lib/marketOverview/analysis/index.ts — Orchestrazione delle sintesi di
// settore. Riusa i MarketSignal già scaricati (per commodities) e recupera il
// resto (macro bond, ciclo BTC, sotto-mercati azionari).
import type { MarketSignal } from '../signals'
import { getBondMacro } from '../bonds'
import { analyzeEquities } from './equities'
import { analyzeBonds } from './bonds'
import { analyzeCommodities } from './commodities'
import { analyzeCrypto } from './crypto'
import type { SectorAnalysis } from './types'

export type { SectorAnalysis } from './types'

/**
 * Calcola tutte le sintesi di settore. `signals` sono i MarketSignal appena
 * prodotti dal refresh (riusati per le commodities, evitando doppie chiamate).
 * Le sezioni sono resilienti: un errore in una non blocca le altre.
 */
export async function computeAllAnalyses(signals: MarketSignal[]): Promise<SectorAnalysis[]> {
  // Il rendimento reale euro serve sia ai bond sia all'oro → una sola fetch.
  const macro = await getBondMacro()

  const [equities, bonds, crypto] = await Promise.all([
    analyzeEquities(),
    analyzeBonds(macro),
    analyzeCrypto(),
  ])
  const commodities = await analyzeCommodities(signals, macro.realYield)

  return [equities, bonds, commodities, crypto]
}
