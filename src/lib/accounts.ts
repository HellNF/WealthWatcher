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

export interface InterestWithholdingTotal {
  /** Interesse lordo annuo totale su tutti i conti (con tasso impostato) */
  grossAnnualMinor: number
  /** Ritenuta 26% totale stimata */
  withholdingMinor: number
  /** Interesse netto annuo totale (lordo − ritenuta) */
  netAnnualMinor:   number
  /** Numero di conti con tasso impostato */
  accountCount: number
}

/**
 * Stima la ritenuta 26% complessiva sugli interessi di tutti i conti correnti
 * dell'utente che hanno un tasso impostato.
 */
export function totalInterestWithholding(userId: number): InterestWithholdingTotal {
  const accounts = listAccounts(userId)
  let grossAnnualMinor = 0
  let accountCount     = 0

  for (const acc of accounts) {
    const balance = getAccountBalanceMinor(acc.id)
    const est     = estimateInterest(balance, acc.interest_rate)
    if (!est) continue
    grossAnnualMinor += est.grossAnnualMinor
    accountCount++
  }

  const withholdingMinor = Math.round(grossAnnualMinor * INTEREST_WITHHOLDING)
  const netAnnualMinor   = grossAnnualMinor - withholdingMinor
  return { grossAnnualMinor, withholdingMinor, netAnnualMinor, accountCount }
}

// ── Giacenza media per imposta di bollo ───────────────────────────────────────

export interface AverageBalanceResult {
  /** Giacenza media giornaliera ponderata nell'anno, in minor units. */
  giacenzaMediaMinor: number
  /**
   * Frazione dell'anno in cui il conto risulta attivo (0–1).
   * Usata per il pro-rata dell'imposta di bollo (€34,20 × fractionOfYear).
   * 1.0 se il conto era già aperto prima dell'anno analizzato.
   */
  fractionOfYear: number
}

const MS_PER_DAY = 86_400_000

function daysBetweenDates(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / MS_PER_DAY)
}

/**
 * Calcola la giacenza media giornaliera ponderata per un dato anno a partire
 * dal saldo corrente e dall'elenco completo dei movimenti del conto.
 *
 * Algoritmo: ricava il saldo alla fine dell'anno (o a oggi se l'anno è in corso)
 * sottraendo i movimenti successivi al saldo corrente; poi avanza in avanti nel
 * tempo all'interno dell'anno pesando ogni segmento per i giorni di durata.
 *
 * @param currentBalanceMinor  saldo corrente (da getAccountBalanceMinor)
 * @param movements            tutti i movimenti del conto, ordinati per data ASC
 * @param year                 anno 4 cifre, es. '2026'
 * @param anchorDate           anchor_date del conto (ISO YYYY-MM-DD), o null
 */
export function averageBalanceFromMovements(
  currentBalanceMinor: number,
  movements: { booked_date: string; amount_minor: number }[],
  year: string,
  anchorDate: string | null,
): AverageBalanceResult {
  const yearStart   = `${year}-01-01`
  const yearEnd     = `${year}-12-31`
  const today       = new Date().toISOString().slice(0, 10)
  const effectiveEnd = yearEnd <= today ? yearEnd : today

  // Numero di giorni nell'anno (366 per bisestili)
  const y          = parseInt(year, 10)
  const totalDays  = ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365

  // Saldo alla fine di effectiveEnd: saldo corrente meno i movimenti successivi
  const sumAfterEnd = movements
    .filter(m => m.booked_date > effectiveEnd)
    .reduce((s, m) => s + m.amount_minor, 0)
  const balanceAtEnd = currentBalanceMinor - sumAfterEnd

  // Movimenti dentro l'anno (fino a effectiveEnd), raggruppati per data
  const inYear = movements.filter(m => m.booked_date >= yearStart && m.booked_date <= effectiveEnd)
  const changeByDate = new Map<string, number>()
  for (const m of inYear) {
    changeByDate.set(m.booked_date, (changeByDate.get(m.booked_date) ?? 0) + m.amount_minor)
  }
  const sortedDates = [...changeByDate.keys()].sort()

  // Saldo all'inizio dell'anno, prima di qualunque movimento dell'anno
  const sumInYear  = inYear.reduce((s, m) => s + m.amount_minor, 0)
  let running      = balanceAtEnd - sumInYear

  // Calcola la somma pesata per segmenti
  let weightedSum  = 0
  let prevDate     = yearStart

  for (const d of sortedDates) {
    // Giorni [prevDate, d-1]: balance = running (prima del movimento di d)
    const days = daysBetweenDates(prevDate, d)
    if (days > 0) weightedSum += running * days
    running += changeByDate.get(d)!
    prevDate = d
  }

  // Segmento finale [prevDate, effectiveEnd] incluso
  const finalDays = daysBetweenDates(prevDate, effectiveEnd) + 1
  if (finalDays > 0) weightedSum += running * finalDays

  // Giorni effettivi su cui è stato calcolato (< totalDays se anno in corso)
  const effectiveDays = daysBetweenDates(yearStart, effectiveEnd) + 1
  const giacenzaMediaMinor = effectiveDays > 0 ? Math.round(weightedSum / effectiveDays) : 0

  // fractionOfYear: usata per il pro-rata del bollo
  // Se il conto esisteva prima dell'anno, la frazione è 1.0; se è aperto durante l'anno,
  // la frazione è proporzionale ai giorni di apertura.
  const firstKnown  = movements.length > 0 ? movements[0].booked_date : null
  const openSince   =
    (anchorDate && anchorDate <= yearStart) ? null         // anchor prima dell'anno → conto preesistente
    : anchorDate ?? firstKnown                             // usa anchor o prima transazione
  const fractionOfYear = !openSince || openSince <= yearStart
    ? 1.0
    : Math.min(1, Math.max(0, (daysBetweenDates(openSince, yearEnd) + 1) / totalDays))

  return { giacenzaMediaMinor, fractionOfYear }
}

/**
 * Calcola la giacenza media annua di un conto leggendo saldo e movimenti da SQLite.
 * Usata da `estimatedWealthTaxes` per determinare l'imposta di bollo.
 */
export function accountAverageBalanceMinor(accountId: number, year: string): AverageBalanceResult {
  const currentBalance = getAccountBalanceMinor(accountId)

  const accountRow = sqlite
    .prepare(`SELECT anchor_date FROM bank_accounts WHERE id = ?`)
    .get(accountId) as { anchor_date: string | null } | undefined
  const anchorDate = accountRow?.anchor_date ?? null

  const movements = sqlite
    .prepare(
      `SELECT booked_date, amount_minor
       FROM transactions
       WHERE bank_account_id = ?
       ORDER BY booked_date ASC`,
    )
    .all(accountId) as { booked_date: string; amount_minor: number }[]

  return averageBalanceFromMovements(currentBalance, movements, year, anchorDate)
}
