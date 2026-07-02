// src/lib/portfolioValuation.ts
// Aggregated EUR valuation of a portfolio (value + unrealized P/L + P/L %),
// for compact display in lists (institution page, dashboard). Reuses the FIFO
// summary from positions.ts and converts each currency bucket to EUR.
import { getPortfolioPositions } from './positions'
import { convertToEur } from './fx/convert'

export interface PortfolioValuation {
  marketValueEurMinor:  number | null // null se qualche prezzo è stale/non convertibile
  costEurMinor:         number
  unrealizedPlEurMinor: number | null
  plPct:                number | null // percentuale sul costo, es. +12.34 / -5.6
}

export async function getPortfolioValuationEur(
  userId: number,
  portfolioId: number,
  date: string,
): Promise<PortfolioValuation> {
  const { summary } = getPortfolioPositions(userId, portfolioId)

  let costEur = 0
  let marketEur: number | null = 0
  let plEur: number | null = 0

  for (const c of summary.byCurrency) {
    const cost = await convertToEur(c.totalCostMinor, c.currency, date)
    if (cost !== null) costEur += cost

    if (c.totalMarketMinor !== null && marketEur !== null) {
      const mv = await convertToEur(c.totalMarketMinor, c.currency, date)
      if (mv !== null) marketEur += mv
      else marketEur = null
    } else {
      marketEur = null
    }

    if (c.totalUnrealizedPlMinor !== null && plEur !== null) {
      const pl = await convertToEur(c.totalUnrealizedPlMinor, c.currency, date)
      if (pl !== null) plEur += pl
      else plEur = null
    } else {
      plEur = null
    }
  }

  const plPct =
    marketEur !== null && plEur !== null && costEur > 0
      ? (plEur / costEur) * 100
      : null

  return {
    marketValueEurMinor:  marketEur,
    costEurMinor:         costEur,
    unrealizedPlEurMinor: plEur,
    plPct,
  }
}
