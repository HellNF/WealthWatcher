// src/lib/mortgages.ts — CRUD mutui + calcolo piano di ammortamento alla francese.
//
// Le funzioni pure (monthlyPaymentMinor, amortizationSchedule, mortgageStatus)
// usano Decimal.js per evitare drift float su serie multi-decennali.
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { mortgages } from '@/db/schema'
import type { Mortgage } from '@/db/schema'
import { dec, Decimal, toMinor, fromMinor } from '@/lib/money'

export type { Mortgage }

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function listMortgages(userId: number): Mortgage[] {
  return db
    .select()
    .from(mortgages)
    .where(eq(mortgages.owner_id, userId))
    .orderBy(mortgages.created_at)
    .all()
}

export function getMortgage(userId: number, id: number): Mortgage | undefined {
  return db
    .select()
    .from(mortgages)
    .where(and(eq(mortgages.id, id), eq(mortgages.owner_id, userId)))
    .get()
}

export interface CreateMortgageInput {
  name:                string
  initialCapitalMinor: number
  annualInterestRate:  string   // decimal string, es. "0.035"
  durationMonths:      number
  startDate:           string   // ISO YYYY-MM-DD
  associatedAccountId?: number | null
}

export function createMortgage(userId: number, input: CreateMortgageInput): Mortgage {
  return db
    .insert(mortgages)
    .values({
      owner_id:             userId,
      name:                 input.name,
      initial_capital_minor: input.initialCapitalMinor,
      annual_interest_rate: input.annualInterestRate,
      duration_months:      input.durationMonths,
      start_date:           input.startDate,
      associated_account_id: input.associatedAccountId ?? null,
    })
    .returning()
    .get() as Mortgage
}

export function updateMortgage(
  userId: number,
  id: number,
  input: Partial<CreateMortgageInput> & { currentOutstandingOverrideMinor?: number | null },
): boolean {
  const res = db
    .update(mortgages)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.initialCapitalMinor !== undefined && { initial_capital_minor: input.initialCapitalMinor }),
      ...(input.annualInterestRate !== undefined && { annual_interest_rate: input.annualInterestRate }),
      ...(input.durationMonths !== undefined && { duration_months: input.durationMonths }),
      ...(input.startDate !== undefined && { start_date: input.startDate }),
      ...(input.associatedAccountId !== undefined && { associated_account_id: input.associatedAccountId ?? null }),
      ...('currentOutstandingOverrideMinor' in input && {
        current_outstanding_override_minor: input.currentOutstandingOverrideMinor ?? null,
      }),
    })
    .where(and(eq(mortgages.id, id), eq(mortgages.owner_id, userId)))
    .run()
  return res.changes > 0
}

export function deleteMortgage(userId: number, id: number): boolean {
  const res = db
    .delete(mortgages)
    .where(and(eq(mortgages.id, id), eq(mortgages.owner_id, userId)))
    .run()
  return res.changes > 0
}

// ── Calcolo ammortamento (metodo francese) ────────────────────────────────────

/**
 * Calcola la rata mensile costante (Metodo Francese / Rate Constante).
 * R = C₀ · i(1+i)ⁿ / ((1+i)ⁿ − 1)
 * Arrotonda al centesimo più vicino; result in EUR minor.
 */
export function monthlyPaymentMinor(
  principalMinor: number,
  annualInterestRate: string,
  durationMonths: number,
): number {
  const C0 = dec(principalMinor.toString())
  const i  = dec(annualInterestRate).div(12)   // tasso mensile

  if (i.lte(0)) {
    // Tasso zero: rata = capitale / mesi
    return Math.round(C0.div(durationMonths).toNumber())
  }

  const n     = durationMonths
  const iPlus = dec('1').plus(i)
  const pow   = Decimal.pow(iPlus, n)               // (1+i)^n
  const R     = C0.mul(i).mul(pow).div(pow.minus(1))
  return Math.round(R.toNumber())
}

export interface AmortizationRow {
  monthIndex:             number   // 1-based
  date:                   string   // ISO YYYY-MM-DD (data scadenza rata)
  paymentMinor:           number   // R costante
  interestMinor:          number   // quota interessi del mese
  principalMinor:         number   // quota capitale del mese
  remainingCapitalMinor:  number   // capitale residuo dopo questa rata
}

/**
 * Genera il piano di ammortamento completo per un mutuo.
 * Usa Decimal.js su tutta la serie per evitare drift.
 */
export function amortizationSchedule(m: Mortgage): AmortizationRow[] {
  const rows: AmortizationRow[] = []
  const R   = dec(monthlyPaymentMinor(m.initial_capital_minor, m.annual_interest_rate, m.duration_months).toString())
  const i   = dec(m.annual_interest_rate).div(12)
  let   cap = dec(m.initial_capital_minor.toString())

  const startMs = new Date(m.start_date).getTime()

  for (let k = 1; k <= m.duration_months; k++) {
    const interest   = cap.mul(i)
    const principal  = R.minus(interest)
    cap = cap.minus(principal)
    // Clamp a 0 all'ultima rata per evitare residuo negativo per arrotondamento
    if (k === m.duration_months) cap = dec('0')

    // Data scadenza rata: +k mesi rispetto alla data prima rata
    const d = new Date(startMs)
    d.setMonth(d.getMonth() + (k - 1))
    const date = d.toISOString().slice(0, 10)

    rows.push({
      monthIndex:            k,
      date,
      paymentMinor:          Math.round(R.toNumber()),
      interestMinor:         Math.round(interest.toNumber()),
      principalMinor:        Math.round(principal.toNumber()),
      remainingCapitalMinor: Math.round(cap.toNumber()),
    })
  }
  return rows
}

export interface MortgageStatus {
  currentMonthIndex:      number   // mese corrente (1-based), 0 se non ancora iniziato
  remainingCapitalMinor:  number
  currentRatePrincipal:   number   // quota capitale rata in corso
  currentRateInterest:    number   // quota interessi rata in corso
  totalPaidMinor:         number   // totale versato fino ad oggi
  percentagePaid:         number   // 0–100
  monthlyPaymentMinor:    number
}

/**
 * Restituisce lo stato corrente del mutuo (capitale residuo, mese in corso, ecc.)
 * in base alla data odierna. Se `current_outstanding_override_minor` è valorizzato,
 * usa quello come capitale residuo.
 */
export function mortgageStatus(m: Mortgage, asOfDate: string): MortgageStatus {
  const schedule  = amortizationSchedule(m)
  const R         = monthlyPaymentMinor(m.initial_capital_minor, m.annual_interest_rate, m.duration_months)

  // Trova il mese corrente: prima rata con date >= asOfDate
  const currentRow = schedule.find(r => r.date >= asOfDate) ?? schedule[schedule.length - 1]
  const monthIndex = currentRow?.monthIndex ?? 0

  // Capitale residuo: override manuale o calcolato dalla riga precedente
  let remaining = currentRow?.remainingCapitalMinor ?? 0
  if (m.current_outstanding_override_minor != null) {
    remaining = m.current_outstanding_override_minor
  }

  // Totale pagato = rate delle righe precedenti a quella corrente
  const prevRows    = schedule.filter(r => r.date < asOfDate)
  const totalPaid   = prevRows.reduce((s, r) => s + r.paymentMinor, 0)
  const pctPaid     = Math.min(100, Math.round((totalPaid / (R * m.duration_months)) * 100))

  return {
    currentMonthIndex:     monthIndex,
    remainingCapitalMinor: remaining,
    currentRatePrincipal:  currentRow?.principalMinor ?? 0,
    currentRateInterest:   currentRow?.interestMinor ?? 0,
    totalPaidMinor:        totalPaid,
    percentagePaid:        pctPaid,
    monthlyPaymentMinor:   R,
  }
}

// ── Helper display ─────────────────────────────────────────────────────────────

export function fmtEurMortgage(minor: number): string {
  return fromMinor(minor, 'EUR')
}
