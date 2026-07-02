// src/lib/accounts.ts — BankAccount repository.
// Ownership access mirrors src/lib/institutions.ts: owner OR explicit share.
import { and, desc, eq, exists, or, sql } from 'drizzle-orm'
import { db, sqlite } from '@/db'
import { bankAccounts, shares } from '@/db/schema'
import type { BankAccount } from '@/db/schema'

export type { BankAccount }

/**
 * Visibility predicate: account visible to its owner OR to any user it is
 * explicitly shared with (SPEC §2.1). Mirrors the pattern in institutions.ts.
 */
function visibleTo(userId: number) {
  return or(
    eq(bankAccounts.owner_id, userId),
    exists(
      db
        .select({ _: sql<number>`1` })
        .from(shares)
        .where(
          and(
            eq(shares.entity_type, 'bank_account'),
            eq(shares.entity_id, bankAccounts.id),
            eq(shares.user_id, userId),
          ),
        ),
    ),
  )
}

export function listAccounts(userId: number, institutionId?: number): BankAccount[] {
  const baseWhere = visibleTo(userId)
  const where = institutionId !== undefined
    ? and(baseWhere, eq(bankAccounts.institution_id, institutionId))
    : baseWhere
  return db
    .select()
    .from(bankAccounts)
    .where(where)
    .orderBy(desc(bankAccounts.created_at), desc(bankAccounts.id))
    .all()
}

export function getAccountForUser(userId: number, id: number): BankAccount | undefined {
  return db
    .select()
    .from(bankAccounts)
    .where(and(eq(bankAccounts.id, id), visibleTo(userId)))
    .get()
}

export function createAccount(
  userId: number,
  institutionId: number,
  name: string,
  currency: string,
): BankAccount {
  const row = db
    .insert(bankAccounts)
    .values({ owner_id: userId, institution_id: institutionId, name, currency })
    .returning()
    .get()
  return row as BankAccount
}

// ── Saldo del conto ───────────────────────────────────────────────────────────
// Fonte di verità unica del saldo (usata da pagina conto e da valuation.ts).
// Con anchor impostato: saldo_di_riferimento + Σ(movimenti dopo anchor_date).
// Senza anchor: somma dell'intero storico movimenti (comportamento storico).
// NB: la stessa logica è replicata nel SQL aggregato di src/lib/valuation.ts.
export function getAccountBalanceMinor(accountId: number): number {
  const row = sqlite
    .prepare(
      `SELECT
         CASE WHEN ba.anchor_balance_minor IS NOT NULL
           THEN ba.anchor_balance_minor
                + COALESCE(SUM(CASE WHEN t.booked_date > ba.anchor_date THEN t.amount_minor END), 0)
           ELSE COALESCE(SUM(t.amount_minor), 0)
         END AS balanceMinor
       FROM bank_accounts ba
       LEFT JOIN transactions t ON t.bank_account_id = ba.id
       WHERE ba.id = ?
       GROUP BY ba.id`,
    )
    .get(accountId) as { balanceMinor: number } | undefined
  return row?.balanceMinor ?? 0
}

// Imposta il saldo di riferimento manuale (importo + data). Solo il proprietario.
export function setAccountBalanceAnchor(
  userId: number,
  accountId: number,
  balanceMinor: number,
  date: string,
): boolean {
  const res = db
    .update(bankAccounts)
    .set({ anchor_balance_minor: balanceMinor, anchor_date: date })
    .where(and(eq(bankAccounts.id, accountId), eq(bankAccounts.owner_id, userId)))
    .run()
  return res.changes > 0
}

// Rimuove il saldo di riferimento → torna alla somma dell'intero storico.
export function clearAccountBalanceAnchor(userId: number, accountId: number): boolean {
  const res = db
    .update(bankAccounts)
    .set({ anchor_balance_minor: null, anchor_date: null })
    .where(and(eq(bankAccounts.id, accountId), eq(bankAccounts.owner_id, userId)))
    .run()
  return res.changes > 0
}

// ── Mutations (owner-only) ────────────────────────────────────────────────────

export function updateAccount(
  userId: number,
  id: number,
  fields: { name?: string },
): boolean {
  if (fields.name === undefined) return false
  const res = db
    .update(bankAccounts)
    .set({ name: fields.name })
    .where(and(eq(bankAccounts.id, id), eq(bankAccounts.owner_id, userId)))
    .run()
  return res.changes > 0
}

// Cascades to the account's transactions (ON DELETE CASCADE in the schema).
export function deleteAccount(userId: number, id: number): boolean {
  const res = db
    .delete(bankAccounts)
    .where(and(eq(bankAccounts.id, id), eq(bankAccounts.owner_id, userId)))
    .run()
  return res.changes > 0
}

// Imposta (o azzera con null) il tasso di interesse annuo lordo sulla giacenza.
export function setAccountInterestRate(
  userId: number,
  id: number,
  rate: string | null,
): boolean {
  const res = db
    .update(bankAccounts)
    .set({ interest_rate: rate })
    .where(and(eq(bankAccounts.id, id), eq(bankAccounts.owner_id, userId)))
    .run()
  return res.changes > 0
}

// ── Preview del conto (per liste/panoramiche) ─────────────────────────────────

export interface AccountPreview {
  balanceMinor: number
  txCount:      number
  firstDate:    string | null
  lastDate:     string | null
}

export function getAccountPreview(accountId: number): AccountPreview {
  const balanceMinor = getAccountBalanceMinor(accountId)
  const stats = sqlite
    .prepare(
      `SELECT COUNT(*) AS txCount, MIN(booked_date) AS firstDate, MAX(booked_date) AS lastDate
       FROM transactions WHERE bank_account_id = ?`,
    )
    .get(accountId) as { txCount: number; firstDate: string | null; lastDate: string | null }
  return {
    balanceMinor,
    txCount:   stats.txCount,
    firstDate: stats.firstDate,
    lastDate:  stats.lastDate,
  }
}

// ── Stima interesse sulla giacenza ────────────────────────────────────────────
// Ritenuta fiscale italiana su interessi/redditi da capitale = 26% (SPEC §4.1:
// stima informativa, non consulenza fiscale).
const INTEREST_WITHHOLDING = 0.26

export interface InterestEstimate {
  ratePercent:      number
  grossAnnualMinor: number
  netAnnualMinor:   number
}

/** Interesse annuo stimato sulla giacenza corrente. Null se non applicabile. */
export function estimateInterest(balanceMinor: number, rate: string | null): InterestEstimate | null {
  if (!rate) return null
  const r = parseFloat(rate)
  if (!isFinite(r) || r <= 0 || balanceMinor <= 0) return null
  const grossAnnualMinor = Math.round(balanceMinor * (r / 100))
  const netAnnualMinor   = Math.round(grossAnnualMinor * (1 - INTEREST_WITHHOLDING))
  return { ratePercent: r, grossAnnualMinor, netAnnualMinor }
}
