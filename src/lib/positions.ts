// src/lib/positions.ts — Compute portfolio positions via FIFO engine.
import { getObservation } from '@/lib/prices/observations'
import { getInstrument } from '@/lib/instruments'
import { listTxns, txnsByInstrument } from '@/lib/investmentTxns'
import { runFifo, computePosition } from '@/lib/investments/fifo'
import type { Position } from '@/lib/investments/fifo'

export type { Position }

export interface PortfolioSummary {
  // Totals grouped by currency (positions may trade in different currencies)
  byCurrency: {
    currency:            string
    totalCostMinor:      number
    totalMarketMinor:    number | null  // null if any price is stale
    totalUnrealizedPlMinor: number | null
    totalRealizedPlMinor:   number
    totalDividendMinor:     number
    totalFeesMinor:         number
  }[]
}

/**
 * Compute all positions for a portfolio and return them plus per-currency totals.
 * Ownership is already checked inside listTxns.
 */
export function getPortfolioPositions(
  userId: number,
  portfolioId: number,
): { positions: Position[]; summary: PortfolioSummary } {
  const txns = listTxns(userId, portfolioId)
  if (txns.length === 0) return { positions: [], summary: { byCurrency: [] } }

  const grouped = txnsByInstrument(txns)
  const positions: Position[] = []

  for (const [instrumentId, instrTxns] of grouped) {
    const instrument = getInstrument(instrumentId)
    if (!instrument) continue

    const state = runFifo(instrTxns, instrument.currency)
    const position = computePosition(instrument, state)
    const observation = getObservation(instrument.id, instrument.last_price_at, instrument.last_price)
    position.priceSource = observation?.source ?? (instrument.price_source === 'manual' ? 'manual' : null)
    position.priceKind = observation?.kind ?? (instrument.price_source === 'manual' ? 'manual' : 'legacy')
    position.priceRetrievedAt = observation?.retrieved_at ?? null
    // Costo di carico 0 su una posizione aperta = costo non indicato (es. crypto
    // inserite senza prezzo medio): il P/L sarebbe l'intero valore, quindi è ignoto.
    if (position.costBasisMinor === 0 && Number(position.remainingQty) > 0) {
      position.unrealizedPlMinor = null
      position.unrealizedPlPct = null
    }
    positions.push(position)
  }

  // Sort: largest market value (or cost basis) first
  positions.sort((a, b) => {
    const aVal = a.marketValueMinor ?? a.costBasisMinor
    const bVal = b.marketValueMinor ?? b.costBasisMinor
    return bVal - aVal
  })

  // Aggregate by currency
  const currencyMap = new Map<string, PortfolioSummary['byCurrency'][0]>()
  for (const pos of positions) {
    const cur = pos.currency
    const existing = currencyMap.get(cur) ?? {
      currency:                  cur,
      totalCostMinor:            0,
      totalMarketMinor:          0,
      totalUnrealizedPlMinor:    0,
      totalRealizedPlMinor:      0,
      totalDividendMinor:        0,
      totalFeesMinor:            0,
    }

    existing.totalCostMinor        += pos.costBasisMinor
    existing.totalRealizedPlMinor  += pos.realizedPlMinor
    existing.totalDividendMinor    += pos.dividendIncomeMinor
    existing.totalFeesMinor        += pos.feesMinor

    if (pos.marketValueMinor !== null && existing.totalMarketMinor !== null) {
      existing.totalMarketMinor       += pos.marketValueMinor
      existing.totalUnrealizedPlMinor = (existing.totalUnrealizedPlMinor ?? 0) + (pos.unrealizedPlMinor ?? 0)
    } else {
      existing.totalMarketMinor       = null
      existing.totalUnrealizedPlMinor = null
    }

    currencyMap.set(cur, existing)
  }

  return {
    positions,
    summary: { byCurrency: [...currencyMap.values()] },
  }
}
