// Net-worth snapshot computation and persistence.
// Net worth = Σ portfolio market values + Σ bank account balances, all → EUR.
// "stale" = true when any component couldn't be converted (missing FX rate).
import { db, sqlite } from '@/db'
import { valuationSnapshots } from '@/db/schema'
import { and, eq, desc, gte } from 'drizzle-orm'
import type { ValuationSnapshot } from '@/db/schema'
import { listPortfolios } from '@/lib/portfolios'
import { getPortfolioPositions } from '@/lib/positions'
import { convertToEur } from '@/lib/fx/convert'
import { refreshFxRates } from '@/lib/fx/rates'

export type { ValuationSnapshot }

// ── Account balances ──────────────────────────────────────────────────────────

interface AccountBalance {
  accountId: number
  name:      string
  currency:  string
  balanceMinor: number
}

function getAccountBalances(userId: number): AccountBalance[] {
  const rows = sqlite.prepare(`
    SELECT
      ba.id            AS accountId,
      ba.name          AS name,
      ba.currency      AS currency,
      COALESCE(SUM(t.amount_minor), 0) AS balanceMinor
    FROM bank_accounts ba
    LEFT JOIN transactions t ON t.bank_account_id = ba.id
    WHERE ba.owner_id = ?
    GROUP BY ba.id, ba.name, ba.currency
  `).all(userId) as AccountBalance[]
  return rows
}

// ── Net-worth computation ─────────────────────────────────────────────────────

export interface NetWorthResult {
  netWorthEurMinor:   number
  investmentsEurMinor: number
  accountsEurMinor:   number
  breakdown: {
    portfolios: { portfolioId: number; name: string; currency: string; eurMinor: number | null; originalMinor: number | null }[]
    accounts:   { accountId: number; name: string; currency: string; eurMinor: number | null; originalMinor: number }[]
  }
  stale: boolean
}

export async function computeNetWorth(userId: number, date: string): Promise<NetWorthResult> {
  let investmentsEurMinor = 0
  let accountsEurMinor    = 0
  let stale               = false

  const portfolioBreakdown: NetWorthResult['breakdown']['portfolios'] = []
  const accountBreakdown:   NetWorthResult['breakdown']['accounts']   = []

  // ── Investments ──
  const portfolios = listPortfolios(userId)
  for (const portfolio of portfolios) {
    const { summary } = getPortfolioPositions(userId, portfolio.id)
    let portfolioEurMinor: number | null = 0

    for (const bucket of summary.byCurrency) {
      if (bucket.totalMarketMinor === null) {
        portfolioEurMinor = null
        stale = true
        continue
      }
      const eur = await convertToEur(bucket.totalMarketMinor, bucket.currency, date)
      if (eur === null) {
        stale = true
        // skip this bucket but don't nullify the whole portfolio
      } else {
        if (portfolioEurMinor !== null) portfolioEurMinor += eur
        investmentsEurMinor += eur
      }
    }

    const originalMinor = summary.byCurrency.reduce<number | null>((acc, b) => {
      if (acc === null || b.totalMarketMinor === null) return null
      return acc + b.totalMarketMinor
    }, 0)

    portfolioBreakdown.push({
      portfolioId:   portfolio.id,
      name:          portfolio.name,
      currency:      portfolio.currency,
      eurMinor:      portfolioEurMinor,
      originalMinor,
    })
  }

  // ── Accounts ──
  const accounts = getAccountBalances(userId)
  for (const acc of accounts) {
    const eur = await convertToEur(acc.balanceMinor, acc.currency, date)
    if (eur === null) {
      stale = true
    } else {
      accountsEurMinor += eur
    }
    accountBreakdown.push({
      accountId:     acc.accountId,
      name:          acc.name,
      currency:      acc.currency,
      eurMinor:      eur,
      originalMinor: acc.balanceMinor,
    })
  }

  return {
    netWorthEurMinor:    investmentsEurMinor + accountsEurMinor,
    investmentsEurMinor,
    accountsEurMinor,
    breakdown: { portfolios: portfolioBreakdown, accounts: accountBreakdown },
    stale,
  }
}

// ── Snapshot persistence ──────────────────────────────────────────────────────

export async function takeSnapshot(userId: number, date?: string): Promise<ValuationSnapshot> {
  const d = date ?? new Date().toISOString().slice(0, 10)
  await refreshFxRates(d)

  const result = await computeNetWorth(userId, d)

  sqlite.prepare(`
    INSERT INTO valuation_snapshots
      (owner_id, date, net_worth_eur_minor, investments_eur_minor, accounts_eur_minor, breakdown, stale)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (owner_id, date) DO UPDATE SET
      net_worth_eur_minor   = excluded.net_worth_eur_minor,
      investments_eur_minor = excluded.investments_eur_minor,
      accounts_eur_minor    = excluded.accounts_eur_minor,
      breakdown             = excluded.breakdown,
      stale                 = excluded.stale
  `).run(
    userId,
    d,
    result.netWorthEurMinor,
    result.investmentsEurMinor,
    result.accountsEurMinor,
    JSON.stringify(result.breakdown),
    result.stale ? 1 : 0,
  )

  return db
    .select()
    .from(valuationSnapshots)
    .where(eq(valuationSnapshots.owner_id, userId))
    .orderBy(desc(valuationSnapshots.date))
    .get() as ValuationSnapshot
}

export function hasSnapshot(userId: number, date: string): boolean {
  const row = sqlite
    .prepare(`SELECT id FROM valuation_snapshots WHERE owner_id = ? AND date = ?`)
    .get(userId, date)
  return row != null
}

export async function ensureTodaySnapshot(userId: number): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10)
    if (!hasSnapshot(userId, today)) {
      await takeSnapshot(userId, today)
    }
  } catch {
    // Non-blocking — dashboard loads even if snapshot fails
  }
}

export function listSnapshots(userId: number, fromDate?: string): ValuationSnapshot[] {
  const filter = fromDate
    ? and(eq(valuationSnapshots.owner_id, userId), gte(valuationSnapshots.date, fromDate))
    : eq(valuationSnapshots.owner_id, userId)

  return db
    .select()
    .from(valuationSnapshots)
    .where(filter)
    .orderBy(valuationSnapshots.date)
    .all() as ValuationSnapshot[]
}
