// src/lib/reports.ts — Monthly spending report queries.
import { sqlite } from '@/db'

export interface CategoryTotal {
  category_id:   number | null
  category_name: string | null
  kind:          string | null
  total_minor:   number
  count:         number
}

export interface MerchantTotal {
  merchant_id:   number | null
  merchant_name: string | null
  category_name: string | null
  total_minor:   number
  count:         number
}

export interface MonthlyReport {
  month:            string   // YYYY-MM
  totalOutflow:     number   // negative sum (negative minor units)
  totalInflow:      number   // positive sum
  byCategory:       CategoryTotal[]
  byMerchant:       MerchantTotal[]
}

/**
 * Monthly spending report for a user, optionally filtered to one account.
 * `month` must be in `YYYY-MM` format.
 */
export function monthlyReport(
  userId: number,
  month: string,
  bankAccountId?: number,
): MonthlyReport {
  const accountFilter = bankAccountId ? 'AND t.bank_account_id = ?' : ''
  const baseArgs = bankAccountId
    ? [userId, month, bankAccountId]
    : [userId, month]

  const totals = sqlite
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN amount_minor < 0 THEN amount_minor ELSE 0 END), 0) AS total_outflow,
         COALESCE(SUM(CASE WHEN amount_minor > 0 THEN amount_minor ELSE 0 END), 0) AS total_inflow
       FROM transactions t
       WHERE t.owner_id = ? AND substr(t.booked_date, 1, 7) = ? ${accountFilter}`,
    )
    .get(...baseArgs) as { total_outflow: number; total_inflow: number }

  const byCategory = sqlite
    .prepare(
      `SELECT
         t.category_id,
         c.name  AS category_name,
         c.kind  AS kind,
         SUM(t.amount_minor)   AS total_minor,
         COUNT(*)              AS count
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.owner_id = ? AND substr(t.booked_date, 1, 7) = ?
         AND t.amount_minor < 0
         ${accountFilter}
       GROUP BY t.category_id
       ORDER BY total_minor ASC`,
    )
    .all(...baseArgs) as CategoryTotal[]

  const byMerchant = sqlite
    .prepare(
      `SELECT
         t.merchant_id,
         m.canonical_name AS merchant_name,
         c.name           AS category_name,
         SUM(t.amount_minor)  AS total_minor,
         COUNT(*)             AS count
       FROM transactions t
       LEFT JOIN merchants  m ON m.id = t.merchant_id
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.owner_id = ? AND substr(t.booked_date, 1, 7) = ?
         AND t.amount_minor < 0
         ${accountFilter}
       GROUP BY t.merchant_id
       ORDER BY total_minor ASC
       LIMIT 20`,
    )
    .all(...baseArgs) as MerchantTotal[]

  return {
    month,
    totalOutflow: totals.total_outflow,
    totalInflow:  totals.total_inflow,
    byCategory,
    byMerchant,
  }
}

/** List of months (YYYY-MM) for which the user has imported transactions. */
export function availableMonths(userId: number, bankAccountId?: number): string[] {
  const accountFilter = bankAccountId ? 'AND bank_account_id = ?' : ''
  const args = bankAccountId ? [userId, bankAccountId] : [userId]
  const rows = sqlite
    .prepare(
      `SELECT DISTINCT substr(booked_date, 1, 7) AS month
       FROM transactions
       WHERE owner_id = ? ${accountFilter}
       ORDER BY month DESC`,
    )
    .all(...args) as { month: string }[]
  return rows.map((r) => r.month)
}
