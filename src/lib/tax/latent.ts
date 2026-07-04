// src/lib/tax/latent.ts — Latent (unrealized) capital gain tax computation.
// For each open position, estimate the theoretical tax if sold today at the current price.
// Result: gross net worth vs. real net worth (net of latent tax burden).
import { dec, Decimal } from '@/lib/money'
import { listPortfolios } from '@/lib/portfolios'
import { getPortfolioPositions } from '@/lib/positions'
import { convertToEur } from '@/lib/fx/convert'
import { listInstruments } from '@/lib/instruments'
import { syntheticRate, incomeType } from './rates'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LatentTaxStats {
  /** Sum of all market values in EUR minor (investments portion only) */
  grossInvestmentMinor: number
  /** Estimated tax due if all open positions with unrealized gains were sold today */
  latentTaxMinor: number
  /** grossInvestmentMinor − latentTaxMinor */
  netInvestmentMinor: number
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Compute the latent tax stats across all portfolios of a user.
 *
 * For each open position (unrealizedPlMinor > 0):
 *   - Apply syntheticRate(instrument.whitelist_percentage) for the tax rate
 *   - Treat ETF gains as reddito di capitale (still taxed; just not offset-eligible)
 *   - Convert non-EUR positions to EUR before aggregating (using today's FX rate)
 *
 * Positions with no price (stale) are excluded from the latent tax calculation
 * to avoid overstating the tax burden.
 *
 * This is an async function because FX conversion may need to fetch rates.
 */
export async function latentTaxStats(userId: number): Promise<LatentTaxStats> {
  const portfolios = listPortfolios(userId)
  const today      = new Date().toISOString().slice(0, 10)

  // Build instrument lookup for whitelist_percentage
  const allInstruments = listInstruments()
  const instrMap = new Map(allInstruments.map(i => [i.id, i]))

  let grossInvestmentMinor = 0
  let latentTaxMinor       = 0

  for (const portfolio of portfolios) {
    const { positions } = getPortfolioPositions(userId, portfolio.id)

    for (const pos of positions) {
      // Skip positions with no price or no holdings
      if (pos.marketValueMinor === null) continue
      if (dec(pos.remainingQty).lte(0)) continue

      // Convert market value to EUR
      const marketEur = pos.currency === 'EUR'
        ? pos.marketValueMinor
        : await convertToEur(pos.marketValueMinor, pos.currency, today)
      if (marketEur === null) continue

      grossInvestmentMinor += marketEur

      // Only latent tax on unrealized gain (not on positions in loss)
      const unrealizedPl = pos.unrealizedPlMinor ?? 0
      if (unrealizedPl <= 0) continue

      // Convert gain to EUR for the tax calculation
      const gainEur = pos.currency === 'EUR'
        ? unrealizedPl
        : await convertToEur(unrealizedPl, pos.currency, today)
      if (gainEur === null) continue

      const instr = instrMap.get(pos.instrumentId)
      const whitelistPct = instr?.whitelist_percentage ?? '0'
      const rate = syntheticRate(whitelistPct)

      // incomeType check: ETF gains are reddito di capitale, still taxed at alpha_etf
      // (the asymmetry is about offset eligibility, not about whether tax applies)
      const taxOnGain = Math.round(gainEur * rate)
      latentTaxMinor += taxOnGain
    }
  }

  return {
    grossInvestmentMinor,
    latentTaxMinor,
    netInvestmentMinor: grossInvestmentMinor - latentTaxMinor,
  }
}
