// src/lib/marketOverview/allocation.ts — Composizione del portafoglio per
// classe di asset (instruments.cluster), aggregata su TUTTI i portafogli
// dell'utente e convertita in EUR. È il Blocco 1 della pagina "Panorama
// Mercati" e la base per l'incrocio con i segnali di mercato (crossref.ts).
//
// Dati 100% locali: nessuna API esterna. Riusa getPortfolioPositions (FIFO),
// getInstrument (per il cluster, che Position non porta) e convertToEur.
import { listPortfolios } from '@/lib/portfolios'
import { getPortfolioPositions } from '@/lib/positions'
import { getInstrument } from '@/lib/instruments'
import { convertToEur } from '@/lib/fx/convert'
import type { Instrument } from '@/db/schema'

export type Cluster = Instrument['cluster'] // 'etf' | 'bond' | 'stock' | 'crypto' | 'other'

export interface ClusterAllocation {
  cluster:       Cluster
  valueEurMinor: number
  pct:           number // 0–100 sul totale valorizzabile
}

export interface AllocationResult {
  byCluster:      ClusterAllocation[]
  totalEurMinor:  number
  /** true se almeno una posizione è stata esclusa perché senza prezzo o non convertibile. */
  hasStalePrices: boolean
}

const CLUSTER_ORDER: Cluster[] = ['stock', 'etf', 'bond', 'crypto', 'other']

/**
 * Allocazione per cluster in EUR. Le posizioni senza prezzo (o in valuta non
 * convertibile alla data) sono escluse dal totale e segnalate via
 * `hasStalePrices`, così le percentuali restano coerenti (sommano a ~100% del
 * valorizzabile) invece di essere falsate da zeri.
 */
export async function getPortfolioAllocation(
  userId: number,
  date:   string,
): Promise<AllocationResult> {
  const portfolios = listPortfolios(userId)
  const totals = new Map<Cluster, number>()
  let total = 0
  let hasStale = false

  for (const p of portfolios) {
    const { positions } = getPortfolioPositions(userId, p.id)
    for (const pos of positions) {
      if (pos.marketValueMinor === null) { hasStale = true; continue }

      const eur = await convertToEur(pos.marketValueMinor, pos.currency, date)
      if (eur === null) { hasStale = true; continue }

      const cluster = getInstrument(pos.instrumentId)?.cluster ?? 'other'
      totals.set(cluster, (totals.get(cluster) ?? 0) + eur)
      total += eur
    }
  }

  const byCluster: ClusterAllocation[] = CLUSTER_ORDER
    .filter((c) => (totals.get(c) ?? 0) > 0)
    .map((cluster) => {
      const valueEurMinor = totals.get(cluster) ?? 0
      return {
        cluster,
        valueEurMinor,
        pct: total > 0 ? (valueEurMinor / total) * 100 : 0,
      }
    })

  return { byCluster, totalEurMinor: total, hasStalePrices: hasStale }
}
