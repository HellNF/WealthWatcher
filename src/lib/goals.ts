// src/lib/goals.ts — Sub-accounting virtuale (metodo delle buste).
//
// La liquidità fisica rimane indistinta nei conti correnti reali; l'allocazione
// agli obiettivi è solo logica (tabella financial_goals). Il saldo dei conti
// non viene mai modificato da queste operazioni.
import { and, eq, sql } from 'drizzle-orm'
import { db, sqlite } from '@/db'
import { financialGoals } from '@/db/schema'
import type { FinancialGoal } from '@/db/schema'
import { convertToEur } from '@/lib/fx/convert'

export type { FinancialGoal }

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function listGoals(userId: number): FinancialGoal[] {
  return db
    .select()
    .from(financialGoals)
    .where(eq(financialGoals.owner_id, userId))
    .orderBy(financialGoals.created_at)
    .all()
}

export function getGoal(userId: number, id: number): FinancialGoal | undefined {
  return db
    .select()
    .from(financialGoals)
    .where(and(eq(financialGoals.id, id), eq(financialGoals.owner_id, userId)))
    .get()
}

export interface CreateGoalInput {
  name:               string
  targetAmountMinor:  number
  targetDate?:        string | null
  colorHex?:          string
}

export function createGoal(userId: number, input: CreateGoalInput): FinancialGoal {
  return db
    .insert(financialGoals)
    .values({
      owner_id:            userId,
      name:                input.name,
      target_amount_minor: input.targetAmountMinor,
      target_date:         input.targetDate ?? null,
      color_hex:           input.colorHex ?? '#3b82f6',
    })
    .returning()
    .get() as FinancialGoal
}

export function updateGoal(
  userId: number,
  id: number,
  input: Partial<CreateGoalInput>,
): boolean {
  const now = Math.floor(Date.now() / 1000)
  const res = db
    .update(financialGoals)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.targetAmountMinor !== undefined && { target_amount_minor: input.targetAmountMinor }),
      ...('targetDate' in input && { target_date: input.targetDate ?? null }),
      ...(input.colorHex !== undefined && { color_hex: input.colorHex }),
      updated_at: now,
    })
    .where(and(eq(financialGoals.id, id), eq(financialGoals.owner_id, userId)))
    .run()
  return res.changes > 0
}

export function deleteGoal(userId: number, id: number): boolean {
  const res = db
    .delete(financialGoals)
    .where(and(eq(financialGoals.id, id), eq(financialGoals.owner_id, userId)))
    .run()
  return res.changes > 0
}

// ── Allocazione ───────────────────────────────────────────────────────────────

export type AllocateResult = 'ok' | 'INSUFFICIENT_UNALLOCATED_CASH' | 'NOT_FOUND'

/**
 * Modifica l'allocazione di un obiettivo di `deltaMinor` euro minor.
 * Positivo = alloca, Negativo = preleva.
 *
 * Verifica che il totale allocato (incluso il delta) non superi la liquidità
 * reale disponibile su tutti i conti correnti in EUR.
 */
export async function allocateToGoal(
  userId: number,
  goalId: number,
  deltaMinor: number,
): Promise<AllocateResult> {
  const goal = getGoal(userId, goalId)
  if (!goal) return 'NOT_FOUND'

  if (deltaMinor > 0) {
    const summary = await computeGoalsSummary(userId)
    // dopo l'allocazione: TotalAllocated + delta <= TotalCash
    if (summary.totalAllocatedMinor + deltaMinor > summary.totalCashMinor) {
      return 'INSUFFICIENT_UNALLOCATED_CASH'
    }
  }

  const newAllocated = Math.max(0, goal.current_allocated_minor + deltaMinor)
  const now = Math.floor(Date.now() / 1000)
  db.update(financialGoals)
    .set({ current_allocated_minor: newAllocated, updated_at: now })
    .where(and(eq(financialGoals.id, goalId), eq(financialGoals.owner_id, userId)))
    .run()

  return 'ok'
}

// ── Riepilogo ─────────────────────────────────────────────────────────────────

export interface GoalsSummary {
  totalCashMinor:       number   // somma saldi conti correnti in EUR
  totalAllocatedMinor:  number   // somma current_allocated_minor di tutti gli obiettivi
  freeOperatingCashMinor: number // totalCash − totalAllocated
}

/**
 * Calcola la liquidità disponibile al netto degli obiettivi allocati.
 * Converte i saldi non-EUR in EUR usando il tasso odierno (FX BCE).
 */
export async function computeGoalsSummary(userId: number): Promise<GoalsSummary> {
  const today = new Date().toISOString().slice(0, 10)

  // Saldi di tutti i conti correnti (anchor-aware), stessa query di valuation.ts
  const accounts = sqlite.prepare(`
    SELECT ba.currency,
           CASE WHEN ba.anchor_balance_minor IS NOT NULL
             THEN ba.anchor_balance_minor
                  + COALESCE(SUM(CASE WHEN t.booked_date > ba.anchor_date THEN t.amount_minor END), 0)
             ELSE COALESCE(SUM(t.amount_minor), 0)
           END AS balanceMinor
    FROM bank_accounts ba
    LEFT JOIN transactions t ON t.bank_account_id = ba.id
    WHERE ba.owner_id = ?
    GROUP BY ba.id, ba.currency
  `).all(userId) as { currency: string; balanceMinor: number }[]

  let totalCashMinor = 0
  for (const acc of accounts) {
    const eur = acc.currency === 'EUR'
      ? acc.balanceMinor
      : await convertToEur(acc.balanceMinor, acc.currency, today).catch(() => null)
    if (eur != null) totalCashMinor += eur
  }

  const goals = listGoals(userId)
  const totalAllocatedMinor = goals.reduce((s, g) => s + g.current_allocated_minor, 0)

  return {
    totalCashMinor,
    totalAllocatedMinor,
    freeOperatingCashMinor: totalCashMinor - totalAllocatedMinor,
  }
}

/** Un obiettivo è COMPLETATO quando l'allocazione ha raggiunto (o superato) il target. */
export function isGoalCompleted(goal: FinancialGoal): boolean {
  return goal.current_allocated_minor >= goal.target_amount_minor
}
