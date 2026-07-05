// src/lib/tax/pension.ts — Monitor deducibilità fondi pensione integrativi (Art. 10 TUIR).
//
// Scansiona le transazioni di conto corrente con categoria 'Previdenza' nell'anno
// solare, calcola lo spazio residuo rispetto al massimale €5.164,57 e stima il
// risparmio IRPEF generato e quello ancora disponibile.
import { sqlite } from '@/db'
import { getUserProfile } from '@/lib/userSettings'
import { MAX_PENSION_DEDUCTION_EUR_MINOR } from './rates'

export interface PensionTaxStatus {
  contributionsCurrentYearMinor: number
  maxDeductionLimitMinor:        number   // sempre MAX_PENSION_DEDUCTION_EUR_MINOR
  remainingDeductibleSpaceMinor: number
  currentTaxRefundRealizedMinor: number
  potentialTaxRefundRemainingMinor: number
  progressBarPercentage:         number   // 0–100 (clamped)
  marginalRate:                  number | null
  year:                          string
}

export function getPensionTaxStatus(userId: number, year: string): PensionTaxStatus {
  const profile     = getUserProfile(userId)
  const marginalRate = profile.irpefMarginalRate

  // Somma contributi versati nell'anno (amount_minor è negativo sulle uscite)
  const row = sqlite.prepare(`
    SELECT COALESCE(SUM(ABS(t.amount_minor)), 0) AS total
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE t.owner_id = ?
      AND c.name = 'Previdenza'
      AND t.amount_minor < 0
      AND t.booked_date >= ? AND t.booked_date <= ?
  `).get(userId, `${year}-01-01`, `${year}-12-31`) as { total: number }

  const contrib = row.total
  const max     = MAX_PENSION_DEDUCTION_EUR_MINOR

  const remainingDeductibleSpaceMinor    = Math.max(0, max - contrib)
  const effectiveDeductible              = Math.min(contrib, max)
  const currentTaxRefundRealizedMinor    = marginalRate != null ? Math.round(effectiveDeductible * marginalRate) : 0
  const potentialTaxRefundRemainingMinor = marginalRate != null ? Math.round(remainingDeductibleSpaceMinor * marginalRate) : 0
  const progressBarPercentage            = max > 0 ? Math.min(100, Math.round((contrib / max) * 100)) : 0

  return {
    contributionsCurrentYearMinor:    contrib,
    maxDeductionLimitMinor:           max,
    remainingDeductibleSpaceMinor,
    currentTaxRefundRealizedMinor,
    potentialTaxRefundRemainingMinor,
    progressBarPercentage,
    marginalRate,
    year,
  }
}
