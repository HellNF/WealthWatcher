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
import type { EquityEvidence } from '../evidence'

export type { SectorAnalysis } from './types'

/**
 * Calcola tutte le sintesi di settore. `signals` sono i MarketSignal appena
 * prodotti dal refresh (riusati per le commodities, evitando doppie chiamate).
 * `evidence` (dataset Shiller) alimenta la valutazione di lungo periodo dell'azionario
 * USA; se manca, quei driver risultano "dato non disponibile" e la confidenza cala.
 * Le sezioni sono resilienti: un errore in una non blocca le altre.
 */
export async function computeAllAnalyses(
  signals:  MarketSignal[],
  evidence: EquityEvidence | null = null,
): Promise<SectorAnalysis[]> {
  // Il rendimento reale euro serve sia ai bond sia all'oro → una sola fetch.
  const macro = await getBondMacro()

  const [equities, bonds, crypto] = await Promise.all([
    analyzeEquities(evidence),
    analyzeBonds(macro),
    analyzeCrypto(),
  ])
  const commodities = await analyzeCommodities(signals, macro.realYield)

  return [equities, bonds, commodities, crypto]
}
