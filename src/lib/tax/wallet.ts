// src/lib/tax/wallet.ts — Lo Zainetto Fiscale (fiscal loss carry-forward wallet).
// Derived from investment_txns — NOT persisted separately. The source of truth
// remains investment_txns; this module replays them to compute the current
// state of compensable losses (minusvalenze) and their expiry under Art. 68 TUIR.
//
// Compensation rules:
//  • Minusvalenze da azioni, bond, cripto, ETF in perdita → "Redditi Diversi" → generano credito
//  • Plusvalenze da ETF → "Redditi di Capitale" → NON consumano crediti
//  • Plusvalenze da azioni/bond/cripto → "Redditi Diversi" → consumano crediti FIFO per expiry_date ASC
//  • Crediti scaduti (expiry_date < oggi) → ignorati
import { dec, Decimal } from '@/lib/money'
import { sqlite } from '@/db'
import { syntheticRate, expiryDate, incomeType } from './rates'
import { realizedSaleEvents } from './realized'
import type { RealizedSaleEvent } from './realized'
import type { InvestmentTxn } from '@/db/schema'

// ── Types ─────────────────────────────────────────────────────────────────────

/** A single loss credit in the fiscal wallet, with its expiry */
export interface TaxLossCredit {
  realizedDate: string   // ISO YYYY-MM-DD — date the loss was realized
  expiryDate:   string   // ISO YYYY-MM-DD — 31 Dec of 4th following year
  amountMinor:  number   // residual credit amount (positive, in EUR-equivalent minor)
}

/** Summary of the entire fiscal wallet for a user */
export interface FiscalWallet {
  /** All active (non-expired, non-exhausted) loss credits, ordered by expiry ASC */
  credits: TaxLossCredit[]
  /** Total residual credit available today */
  totalCreditMinor: number
  /** Credits expiring by end of current calendar year (could be lost if unused) */
  expiringThisYearMinor: number
  /** Gross credit already expired (informational only) */
  expiredCreditMinor: number
}

// ── Internal row types ────────────────────────────────────────────────────────

interface TxnRow {
  type:        'buy' | 'sell' | 'dividend' | 'fee'
  trade_date:  string
  quantity:    string | null
  unit_price:  string | null
  fee_minor:   number
  amount_minor: number | null
  currency:    string
  instrument_id: number
}

interface InstrumentRow {
  id:                  number
  cluster:             string
  whitelist_percentage: string
  currency:            string
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Compute the full fiscal wallet state for a user by replaying all their
 * investment_txns chronologically across all portfolios.
 *
 * This is a pure computation (no writes, no side effects).
 * Complexity: O(portfolios × instruments × txns) — acceptable for personal-scale portfolios.
 */
export function computeFiscalWallet(userId: number): FiscalWallet {
  const today = new Date().toISOString().slice(0, 10)
  const currentYear = today.slice(0, 4)

  // 1. Load all buy/sell txns for the user, across all portfolios
  const txnRows = sqlite.prepare(`
    SELECT t.type, t.trade_date, t.quantity, t.unit_price, t.fee_minor,
           t.amount_minor, t.currency, t.instrument_id
    FROM investment_txns t
    WHERE t.owner_id = ?
      AND t.type IN ('buy', 'sell')
      AND t.quantity IS NOT NULL
      AND t.unit_price IS NOT NULL
    ORDER BY t.trade_date ASC, t.id ASC
  `).all(userId) as TxnRow[]

  if (txnRows.length === 0) {
    return { credits: [], totalCreditMinor: 0, expiringThisYearMinor: 0, expiredCreditMinor: 0 }
  }

  // 2. Load instrument metadata (cluster + whitelist_percentage) for referenced instruments
  const instrumentIds = [...new Set(txnRows.map(r => r.instrument_id))]
  const instrRows = sqlite.prepare(
    `SELECT id, cluster, whitelist_percentage, currency FROM instruments WHERE id IN (${instrumentIds.map(() => '?').join(',')})`,
  ).all(...instrumentIds) as InstrumentRow[]
  const instrMap = new Map(instrRows.map(r => [r.id, r]))

  // 3. Group txns by instrument_id (preserving chronological order)
  const byInstrument = new Map<number, TxnRow[]>()
  for (const row of txnRows) {
    const list = byInstrument.get(row.instrument_id) ?? []
    list.push(row)
    byInstrument.set(row.instrument_id, list)
  }

  // 4. Compute realized sale events per instrument and collect all loss/gain events
  const allEvents: (RealizedSaleEvent & { whitelistPct: string })[] = []

  for (const [instrId, rows] of byInstrument) {
    const instr = instrMap.get(instrId)
    if (!instr) continue

    // Cast TxnRow to InvestmentTxn shape (only the fields realizedSaleEvents uses)
    const txnsForFifo = rows.map(r => ({
      ...r,
      id:           0,
      owner_id:     userId,
      portfolio_id: 0,
      note:         null,
      created_at:   0,
    })) as InvestmentTxn[]

    const events = realizedSaleEvents(txnsForFifo, instr.cluster, instr.currency)
    for (const ev of events) {
      allEvents.push({ ...ev, whitelistPct: instr.whitelist_percentage })
    }
  }

  // 5. Sort all events chronologically (already sorted within instrument, mix across instruments)
  allEvents.sort((a, b) => a.date.localeCompare(b.date))

  // 6. Build the fiscal wallet by processing events in order
  //    - Loss events (redditi diversi) → generate credits
  //    - Gain events (redditi diversi only) → consume credits FIFO by expiry ASC
  //    - Gain events (redditi di capitale = ETF gains) → do NOT consume credits

  // Working list of credits, mutable, sorted by expiryDate ASC
  const workingCredits: { realizedDate: string; expiryDate: string; amountMinor: number }[] = []

  for (const ev of allEvents) {
    const type = incomeType(ev.cluster, ev.grossGainMinor)

    if (ev.grossGainMinor < 0) {
      // Loss — this is always reddito diverso regardless of cluster (including ETF loss)
      // The tax credit amount is the absolute loss (not yet multiplied by rate;
      // we store the raw loss amount — rate is applied when displaying or simulating)
      workingCredits.push({
        realizedDate: ev.date,
        expiryDate:   expiryDate(ev.date),
        amountMinor:  Math.abs(ev.grossGainMinor),
      })
      // Keep sorted by expiryDate ASC (insert-in-order since events are chronological
      // and expiryDate(date) = date+4yrs, so order is preserved)
    } else if (ev.grossGainMinor > 0 && type === 'diverse') {
      // Gain eligible for offset — consume credits FIFO by expiry ASC
      let remaining = ev.grossGainMinor
      for (const credit of workingCredits) {
        if (remaining <= 0) break
        if (credit.expiryDate < ev.date) continue  // expired at time of this sale (skip)
        const consumed = Math.min(credit.amountMinor, remaining)
        credit.amountMinor -= consumed
        remaining          -= consumed
      }
    }
    // type === 'capitale' (ETF gain): no credit consumed, no credit generated
  }

  // 7. Finalize: separate active vs expired credits
  const activeCredits: TaxLossCredit[] = []
  let expiredCreditMinor = 0
  let expiringThisYearMinor = 0

  for (const c of workingCredits) {
    if (c.amountMinor <= 0) continue  // fully consumed
    if (c.expiryDate < today) {
      expiredCreditMinor += c.amountMinor
    } else {
      activeCredits.push({
        realizedDate: c.realizedDate,
        expiryDate:   c.expiryDate,
        amountMinor:  c.amountMinor,
      })
      if (c.expiryDate.startsWith(currentYear)) {
        expiringThisYearMinor += c.amountMinor
      }
    }
  }

  // Sort active credits by expiry ASC (oldest first, to be consumed first)
  activeCredits.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))

  const totalCreditMinor = activeCredits.reduce((s, c) => s + c.amountMinor, 0)

  return { credits: activeCredits, totalCreditMinor, expiringThisYearMinor, expiredCreditMinor }
}

// ── Simulation helper ─────────────────────────────────────────────────────────

/**
 * Simulate the offset of a hypothetical gain against the wallet's active credits.
 * Returns the net gain after offset and how much credit was consumed.
 * Does NOT mutate the wallet — pure simulation.
 *
 * @param wallet  - Current fiscal wallet (from computeFiscalWallet)
 * @param gainMinor - Hypothetical gross gain to offset (positive)
 * @param asOfDate  - ISO date of the simulated sale (for expiry check)
 */
export function simulateOffset(
  wallet: FiscalWallet,
  gainMinor: number,
  asOfDate: string,
): { netGainMinor: number; compensatedMinor: number } {
  if (gainMinor <= 0) return { netGainMinor: gainMinor, compensatedMinor: 0 }

  let remaining      = gainMinor
  let compensated    = 0

  for (const credit of wallet.credits) {
    if (remaining <= 0) break
    if (credit.expiryDate < asOfDate) continue  // expired at time of simulated sale
    const used   = Math.min(credit.amountMinor, remaining)
    compensated += used
    remaining   -= used
  }

  return { netGainMinor: remaining, compensatedMinor: compensated }
}

// ── Crypto annual gain accumulator ────────────────────────────────────────────

/**
 * Sum of realized crypto gains for a given calendar year (across all portfolios).
 * Used to evaluate the €2,000 exemption threshold.
 *
 * @param userId - The authenticated user
 * @param year   - 4-digit year string, e.g. '2026'
 */
export function cryptoRealizedGainForYear(userId: number, year: string): number {
  const txnRows = sqlite.prepare(`
    SELECT t.type, t.trade_date, t.quantity, t.unit_price, t.fee_minor,
           t.amount_minor, t.currency, t.instrument_id
    FROM investment_txns t
    JOIN instruments i ON i.id = t.instrument_id
    WHERE t.owner_id = ?
      AND i.cluster = 'crypto'
      AND t.type IN ('buy', 'sell')
      AND t.quantity IS NOT NULL AND t.unit_price IS NOT NULL
      AND substr(t.trade_date, 1, 4) <= ?
    ORDER BY t.trade_date ASC, t.id ASC
  `).all(userId, year) as TxnRow[]

  if (txnRows.length === 0) return 0

  const byInstrument = new Map<number, TxnRow[]>()
  for (const row of txnRows) {
    const list = byInstrument.get(row.instrument_id) ?? []
    list.push(row)
    byInstrument.set(row.instrument_id, list)
  }

  let totalGain = 0
  for (const [instrId, rows] of byInstrument) {
    const instrRow = sqlite.prepare(
      `SELECT cluster, currency FROM instruments WHERE id = ?`,
    ).get(instrId) as { cluster: string; currency: string } | undefined
    if (!instrRow) continue

    const txnsForFifo = rows.map(r => ({
      ...r,
      id: 0, owner_id: userId, portfolio_id: 0, note: null, created_at: 0,
    })) as InvestmentTxn[]

    const events = realizedSaleEvents(txnsForFifo, instrRow.cluster, instrRow.currency)
    for (const ev of events) {
      // Only count gains in the target year
      if (!ev.date.startsWith(year)) continue
      if (ev.grossGainMinor > 0) totalGain += ev.grossGainMinor
    }
  }

  return totalGain
}
