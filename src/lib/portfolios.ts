// src/lib/portfolios.ts — InvestmentPortfolio repository.
// Access control: visibleTo(userId) mirrors accounts.ts / institutions.ts pattern.
import { and, desc, eq, exists, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { investmentPortfolios, shares } from '@/db/schema'
import type { InvestmentPortfolio } from '@/db/schema'

export type { InvestmentPortfolio }

function visibleTo(userId: number) {
  return or(
    eq(investmentPortfolios.owner_id, userId),
    exists(
      db.select({ _: sql<number>`1` }).from(shares).where(
        and(
          eq(shares.entity_type, 'investment_portfolio'),
          eq(shares.entity_id, investmentPortfolios.id),
          eq(shares.user_id, userId),
        ),
      ),
    ),
  )
}

export function listPortfolios(
  userId: number,
  institutionId?: number,
): InvestmentPortfolio[] {
  const base = visibleTo(userId)
  const filter = institutionId
    ? and(base, eq(investmentPortfolios.institution_id, institutionId))
    : base
  return db
    .select()
    .from(investmentPortfolios)
    .where(filter)
    .orderBy(desc(investmentPortfolios.created_at), desc(investmentPortfolios.id))
    .all() as InvestmentPortfolio[]
}

export function getPortfolioForUser(
  userId: number,
  id: number,
): InvestmentPortfolio | undefined {
  return db
    .select()
    .from(investmentPortfolios)
    .where(and(eq(investmentPortfolios.id, id), visibleTo(userId)))
    .get() as InvestmentPortfolio | undefined
}

export function createPortfolio(
  userId:        number,
  institutionId: number,
  name:          string,
  currency:      string,
  mode:          'transactions' | 'holdings' = 'transactions',
): InvestmentPortfolio {
  return db
    .insert(investmentPortfolios)
    .values({ owner_id: userId, institution_id: institutionId, name, currency, mode })
    .returning()
    .get() as InvestmentPortfolio
}

// ── Mutations (owner-only) ────────────────────────────────────────────────────

export function updatePortfolio(
  userId: number,
  id: number,
  fields: { name?: string },
): boolean {
  if (fields.name === undefined) return false
  const res = db
    .update(investmentPortfolios)
    .set({ name: fields.name })
    .where(and(eq(investmentPortfolios.id, id), eq(investmentPortfolios.owner_id, userId)))
    .run()
  return res.changes > 0
}

// Cascades to the portfolio's investment_txns (ON DELETE CASCADE in the schema).
export function deletePortfolio(userId: number, id: number): boolean {
  const res = db
    .delete(investmentPortfolios)
    .where(and(eq(investmentPortfolios.id, id), eq(investmentPortfolios.owner_id, userId)))
    .run()
  return res.changes > 0
}
