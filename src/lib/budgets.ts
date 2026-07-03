// src/lib/budgets.ts — Budget repository.
// category_id = NULL → tetto mensile complessivo (uno solo per utente).
// category_id = N    → limite per la categoria N.
// amount_minor è sempre positivo (soglia di uscita in centesimi).
import { sqlite } from '@/db'
import type { Budget } from '@/db/schema'

export type { Budget }

// ── Tipi ─────────────────────────────────────────────────────────────────────

export interface BudgetWithCategory extends Budget {
  category_name: string | null
  category_color: string | null
  category_kind: string | null
}

export interface CategoryBudgetStatus {
  category_id:   number | null
  category_name: string | null
  color:         string | null
  spent_minor:   number         // valore assoluto delle uscite del mese
  limit_minor:   number
  pct:           number         // 0..∞ (>100 = sforato)
}

export interface BudgetStatus {
  perCategory: CategoryBudgetStatus[]
  total: {
    spent_minor: number
    limit_minor: number | null  // null se non configurato
    pct:         number | null
  }
}

// ── Lettura ───────────────────────────────────────────────────────────────────

/** Tutti i budget dell'utente, arricchiti con il nome categoria. */
export function listBudgets(userId: number): BudgetWithCategory[] {
  return sqlite
    .prepare(
      `SELECT b.id, b.owner_id, b.category_id, b.amount_minor, b.created_at,
              c.name  AS category_name,
              c.color AS category_color,
              c.kind  AS category_kind
       FROM budgets b
       LEFT JOIN categories c ON c.id = b.category_id
       WHERE b.owner_id = ?
       ORDER BY b.category_id IS NULL DESC, c.name ASC`,
    )
    .all(userId) as BudgetWithCategory[]
}

/**
 * Calcola lo stato di avanzamento di tutti i budget per un dato mese.
 * `month` deve essere in formato `YYYY-MM`.
 */
export function budgetStatus(userId: number, month: string): BudgetStatus {
  const budgets = listBudgets(userId)

  // Spesa effettiva per categoria nel mese (solo uscite, raggruppata)
  const spendingRows = sqlite
    .prepare(
      `SELECT t.category_id,
              c.name  AS category_name,
              c.color AS color,
              ABS(SUM(t.amount_minor)) AS spent_minor
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.owner_id = ?
         AND substr(t.booked_date, 1, 7) = ?
         AND t.amount_minor < 0
       GROUP BY t.category_id`,
    )
    .all(userId, month) as {
      category_id:   number | null
      category_name: string | null
      color:         string | null
      spent_minor:   number
    }[]

  // Spesa totale del mese (tutte le uscite)
  const totalSpent = (
    sqlite
      .prepare(
        `SELECT ABS(COALESCE(SUM(amount_minor), 0)) AS total
         FROM transactions
         WHERE owner_id = ?
           AND substr(booked_date, 1, 7) = ?
           AND amount_minor < 0`,
      )
      .get(userId, month) as { total: number }
  ).total

  // Budget separato per categoria vs. budget totale
  const totalBudget = budgets.find((b) => b.category_id === null)
  const catBudgets  = budgets.filter((b) => b.category_id !== null)

  // Indice per lookup rapido spesa → categoria
  const spendingByCategory = new Map<number | null, (typeof spendingRows)[0]>()
  for (const row of spendingRows) {
    spendingByCategory.set(row.category_id, row)
  }

  const perCategory: CategoryBudgetStatus[] = catBudgets.map((b) => {
    const spending = spendingByCategory.get(b.category_id ?? null)
    const spent    = spending?.spent_minor ?? 0
    const limit    = b.amount_minor
    return {
      category_id:   b.category_id ?? null,
      category_name: b.category_name,
      color:         b.category_color,
      spent_minor:   spent,
      limit_minor:   limit,
      pct:           limit > 0 ? Math.round((spent / limit) * 100) : 0,
    }
  })

  const totalLimitMinor = totalBudget?.amount_minor ?? null

  return {
    perCategory,
    total: {
      spent_minor: totalSpent,
      limit_minor: totalLimitMinor,
      pct: totalLimitMinor
        ? Math.round((totalSpent / totalLimitMinor) * 100)
        : null,
    },
  }
}

// ── Mutazioni ─────────────────────────────────────────────────────────────────

/**
 * Crea o aggiorna il budget per una categoria (o il totale se categoryId = null).
 * Usa INSERT OR REPLACE per semplicità (SQLite).
 */
export function upsertBudget(
  userId:       number,
  categoryId:   number | null,
  amountMinor:  number,
): void {
  // Cerca se esiste già per applicare UPDATE, altrimenti INSERT.
  const existing = sqlite
    .prepare(
      categoryId !== null
        ? 'SELECT id FROM budgets WHERE owner_id = ? AND category_id = ?'
        : 'SELECT id FROM budgets WHERE owner_id = ? AND category_id IS NULL',
    )
    .get(userId, ...(categoryId !== null ? [categoryId] : [])) as { id: number } | undefined

  if (existing) {
    sqlite
      .prepare('UPDATE budgets SET amount_minor = ? WHERE id = ? AND owner_id = ?')
      .run(amountMinor, existing.id, userId)
  } else {
    sqlite
      .prepare(
        'INSERT INTO budgets (owner_id, category_id, amount_minor) VALUES (?, ?, ?)',
      )
      .run(userId, categoryId ?? null, amountMinor)
  }
}

export function deleteBudget(id: number, userId: number): void {
  sqlite
    .prepare('DELETE FROM budgets WHERE id = ? AND owner_id = ?')
    .run(id, userId)
}
