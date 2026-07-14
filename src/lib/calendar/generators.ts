// src/lib/calendar/generators.ts — I generatori di eventi dello scadenziario.
//
// Ogni generatore trasforma una fonte dati in DeadlineEvent[]. Riusa i motori
// analitici/fiscali esistenti (detectRecurring, computeFiscalWallet, incomeProfile,
// estimatedWealthTaxes, amortizationSchedule…) e non duplica logica: dove un motore
// più potente esiste già, lo si collega invece di riscriverne una versione semplice.
import { sqlite } from '@/db'
import { median, gapsInDays } from '@/lib/spending'
import { incomeProfile } from '@/lib/spendingInsights'
import { listMortgages, amortizationSchedule } from '@/lib/mortgages'
import { listGoals } from '@/lib/goals'
import { cryptoRealizedGainForYear } from '@/lib/tax/wallet'
import type { RecurringItem, RecurringCadence } from '@/lib/analytics'
import type { FiscalWallet } from '@/lib/tax/wallet'
import type { WealthTaxStats } from '@/lib/tax/wealth'
import type { FlowTxn } from '@/lib/spending'
import type { DeadlineEvent } from './types'

// ── Contesto condiviso ─────────────────────────────────────────────────────────
// Costruito una sola volta in index.ts e passato a tutti i generatori per evitare
// query e ricalcoli duplicati.

export interface GenCtx {
  userId:       number
  from:         string           // ISO YYYY-MM-DD
  to:           string           // ISO YYYY-MM-DD
  today:        string           // ISO YYYY-MM-DD
  recurring:    RecurringItem[]   // da transactionStats
  incomes:      FlowTxn[]         // entrate reali (da transactionStats)
  wallet:       FiscalWallet      // zainetto fiscale
  wealthByYear: Map<string, WealthTaxStats>  // imposte patrimoniali per anno
  hasCrypto:    boolean
}

// ── Helper date ─────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000

function inRange(iso: string, from: string, to: string): boolean {
  return iso >= from && iso <= to
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Giorni nominali di una cadenza, per proiettare le occorrenze future. */
const CADENCE_DAYS: Record<RecurringCadence, number> = {
  weekly: 7, biweekly: 14, monthly: 30, bimonthly: 61,
  quarterly: 91, semiannual: 182, annual: 365,
}

/** Anni (4 cifre) interamente o parzialmente coperti dall'intervallo [from, to]. */
export function yearsInRange(from: string, to: string): string[] {
  const y0 = parseInt(from.slice(0, 4), 10)
  const y1 = parseInt(to.slice(0, 4), 10)
  const out: string[] = []
  for (let y = y0; y <= y1; y++) out.push(String(y))
  return out
}

// ── 1. Imposte patrimoniali (bollo / IVAFE) ─────────────────────────────────────
// FIX del bug storico: le scadenze statutarie venivano generate solo per l'anno di
// `from`. Ora si itera su OGNI anno dell'intervallo.

export function wealthDeadlines(ctx: GenCtx): DeadlineEvent[] {
  const events: DeadlineEvent[] = []

  for (const [year, taxes] of ctx.wealthByYear) {
    for (const line of taxes.lines) {
      if (line.taxEurMinor === 0) continue

      if (line.regime === 'bollo') {
        const d = `${year}-12-31`
        if (!inRange(d, ctx.from, ctx.to)) continue
        events.push({
          date: d, source: 'bollo', kind: 'cash', direction: 'out',
          label: `Imposta di bollo — ${line.name}`,
          amountMinor: line.taxEurMinor, confidence: 'estimated',
          meta: { kind: line.kind, id: line.id, year },
        })
      } else {
        // IVAFE: saldo 30/06 (60%) + acconto 30/11 (40%)
        const saldo = `${year}-06-30`, acconto = `${year}-11-30`
        const saldoAmt = Math.round(line.taxEurMinor * 0.6)
        const accontoAmt = Math.round(line.taxEurMinor * 0.4)
        if (saldoAmt > 0 && inRange(saldo, ctx.from, ctx.to)) {
          events.push({
            date: saldo, source: 'ivafe', kind: 'cash', direction: 'out',
            label: `IVAFE saldo — ${line.name}`, amountMinor: saldoAmt,
            confidence: 'estimated', meta: { kind: line.kind, id: line.id, year },
          })
        }
        if (accontoAmt > 0 && inRange(acconto, ctx.from, ctx.to)) {
          events.push({
            date: acconto, source: 'ivafe', kind: 'cash', direction: 'out',
            label: `IVAFE acconto — ${line.name}`, amountMinor: accontoAmt,
            confidence: 'estimated', meta: { kind: line.kind, id: line.id, year },
          })
        }
      }
    }
  }
  return events
}

// ── 2. Crediti fiscali in scadenza (zainetto) ───────────────────────────────────

export function creditDeadlines(ctx: GenCtx): DeadlineEvent[] {
  return ctx.wallet.credits
    .filter(c => c.amountMinor > 0 && inRange(c.expiryDate, ctx.from, ctx.to))
    .map(c => {
      const days = Math.round((Date.parse(c.expiryDate) - Date.parse(ctx.today)) / DAY_MS)
      return {
        date: c.expiryDate, source: 'credito_fiscale' as const,
        kind: 'opportunity' as const, direction: 'none' as const,
        label: `Credito da minusvalenza in scadenza (${c.expiryDate.slice(0, 4)})`,
        amountMinor: c.amountMinor, confidence: 'certain' as const,
        severity: (days <= 90 ? 'warn' : 'opportunity') as 'warn' | 'opportunity',
        suggestion: 'Compensa con una plusvalenza entro fine anno per non perdere il credito.',
        href: '/dashboard/tasse',
        meta: { expiryDate: c.expiryDate },
      }
    })
}

// ── 3. Rate mutuo ────────────────────────────────────────────────────────────────

export function mortgageDeadlines(ctx: GenCtx): DeadlineEvent[] {
  const events: DeadlineEvent[] = []
  for (const m of listMortgages(ctx.userId)) {
    for (const row of amortizationSchedule(m)) {
      if (row.date < ctx.from) continue
      if (row.date > ctx.to) break
      events.push({
        date: row.date, source: 'rata_mutuo', kind: 'cash', direction: 'out',
        label: `Rata mutuo — ${m.name}`, amountMinor: row.paymentMinor,
        confidence: 'certain',
        meta: {
          mortgageId: m.id, interestMinor: row.interestMinor,
          principalMinor: row.principalMinor, monthIndex: row.monthIndex,
        },
      })
    }
  }
  return events
}

// ── 4. Pagamenti ricorrenti (motore evoluto detectRecurring) ────────────────────
// Sostituisce la vecchia query SQL "ultima+1 mese". Usa la cadenza inferita per
// proiettare TUTTE le occorrenze nell'intervallo, non solo la prima.

export function recurringDeadlines(ctx: GenCtx): DeadlineEvent[] {
  const events: DeadlineEvent[] = []
  for (const r of ctx.recurring) {
    if (r.kind === 'habit' || r.cadence === null || r.status !== 'active') continue
    if (!r.nextExpectedDate) continue

    const stepDays = CADENCE_DAYS[r.cadence]
    let d = r.nextExpectedDate
    // Cap difensivo sul numero di proiezioni (es. settimanale su 2 anni ≈ 104)
    for (let i = 0; i < 130 && d <= ctx.to; i++, d = addDays(d, stepDays)) {
      if (d < ctx.from) continue
      events.push({
        date: d, source: 'ricorrente', kind: 'cash', direction: 'out',
        label: `${r.description}`, amountMinor: r.amountMinor, confidence: 'inferred',
        meta: {
          key: r.key, cadenceLabel: r.cadenceLabel, recurringKind: r.kind,
          priceChangePct: r.priceChangePct,
        },
      })
    }
  }
  return events
}

// ── 5. Dividendi attesi (inferiti dallo storico, pattern detectRecurring) ────────

interface DividendRow {
  instrument_id: number
  name:          string
  symbol:        string | null
  trade_date:    string
  amount_minor:  number
}

export function dividendDeadlines(ctx: GenCtx): DeadlineEvent[] {
  const rows = sqlite.prepare(`
    SELECT t.instrument_id, i.name AS name, i.symbol AS symbol,
           t.trade_date, t.amount_minor
    FROM investment_txns t
    JOIN instruments i ON i.id = t.instrument_id
    WHERE t.owner_id = ?
      AND t.type = 'dividend'
      AND t.amount_minor IS NOT NULL
      AND t.amount_minor > 0
    ORDER BY t.instrument_id, t.trade_date ASC
  `).all(ctx.userId) as DividendRow[]

  // Raggruppa per strumento
  const groups = new Map<number, DividendRow[]>()
  for (const r of rows) {
    const g = groups.get(r.instrument_id) ?? []
    g.push(r)
    groups.set(r.instrument_id, g)
  }

  const events: DeadlineEvent[] = []
  for (const g of groups.values()) {
    if (g.length < 3) continue  // servono almeno 3 stacchi per inferire una cadenza

    const dates = g.map(r => r.trade_date)
    const gaps = gapsInDays(dates)
    if (gaps.length === 0) continue
    const medGap = median(gaps)
    // Accetta solo cadenze plausibili per un dividendo: da mensile a annuale
    if (medGap < 25 || medGap > 400) continue

    const amount = Math.round(median(g.slice(-3).map(r => r.amount_minor)))
    if (amount <= 0) continue

    const last = dates[dates.length - 1]
    const name = g[0].symbol ?? g[0].name
    // Proietta le occorrenze future nell'intervallo
    let d = addDays(last, Math.round(medGap))
    for (let i = 0; i < 40 && d <= ctx.to; i++, d = addDays(d, Math.round(medGap))) {
      if (d < ctx.from || d < ctx.today) continue
      events.push({
        date: d, source: 'dividendo_atteso', kind: 'cash', direction: 'in',
        label: `Dividendo atteso — ${name}`, amountMinor: amount, confidence: 'inferred',
        meta: { instrumentId: g[0].instrument_id, medGapDays: Math.round(medGap) },
      })
    }
  }
  return events
}

// ── 6. Stipendio atteso (da incomeProfile) ──────────────────────────────────────

export function salaryDeadlines(ctx: GenCtx): DeadlineEvent[] {
  const profile = incomeProfile(ctx.incomes)
  if (!profile.hasData || profile.payDayMedian === null || profile.salaryMedianMinor === null) return []
  // Serve una regolarità sufficiente: giorno di accredito poco variabile
  if (profile.payDayJitterDays !== null && profile.payDayJitterDays > 4) return []

  const amount = profile.salaryMedianMinor
  if (amount <= 0) return []
  const payDay = Math.min(28, Math.max(1, profile.payDayMedian))

  const events: DeadlineEvent[] = []
  // Itera mese per mese dall'inizio dell'intervallo
  const [fy, fm] = [parseInt(ctx.from.slice(0, 4), 10), parseInt(ctx.from.slice(5, 7), 10)]
  const [ty, tm] = [parseInt(ctx.to.slice(0, 4), 10), parseInt(ctx.to.slice(5, 7), 10)]
  for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); m === 12 ? (m = 1, y++) : m++) {
    const d = `${y}-${String(m).padStart(2, '0')}-${String(payDay).padStart(2, '0')}`
    if (!inRange(d, ctx.from, ctx.to) || d < ctx.today) continue
    events.push({
      date: d, source: 'stipendio_atteso', kind: 'cash', direction: 'in',
      label: profile.salaryLabel ? `Stipendio atteso — ${profile.salaryLabel}` : 'Stipendio atteso',
      amountMinor: amount, confidence: 'inferred',
      meta: { payDay },
    })
  }
  return events
}

// ── 7. Obiettivi con data target ─────────────────────────────────────────────────

export function goalDeadlines(ctx: GenCtx): DeadlineEvent[] {
  const events: DeadlineEvent[] = []
  const todayMs = Date.parse(ctx.today)

  for (const g of listGoals(ctx.userId)) {
    if (!g.target_date || !inRange(g.target_date, ctx.from, ctx.to)) continue
    const needed = Math.max(0, g.target_amount_minor - g.current_allocated_minor)
    const completed = needed === 0

    // Ritmo di accumulo stimato: allocato finora / giorni dall'apertura
    const ageDays = Math.max(1, (todayMs - g.created_at * 1000) / DAY_MS)
    const dailyPace = g.current_allocated_minor / ageDays
    const daysToTarget = Math.max(0, (Date.parse(g.target_date) - todayMs) / DAY_MS)
    const projectedByTarget = g.current_allocated_minor + dailyPace * daysToTarget
    const atRisk = !completed && projectedByTarget < g.target_amount_minor

    let suggestion: string | undefined
    if (atRisk && daysToTarget > 0) {
      const monthsLeft = Math.max(1, daysToTarget / 30)
      const perMonth = Math.ceil(needed / monthsLeft)
      suggestion = `Al ritmo attuale non raggiungi il target: servono ~${(perMonth / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}/mese in più.`
    }

    events.push({
      date: g.target_date, source: 'obiettivo',
      kind: atRisk ? 'opportunity' : 'info', direction: 'none',
      label: completed ? `Obiettivo raggiunto — ${g.name}` : `Scadenza obiettivo — ${g.name}`,
      amountMinor: needed, confidence: 'certain',
      severity: atRisk ? 'warn' : 'info', suggestion, href: '/dashboard/obiettivi',
      meta: { goalId: g.id, atRisk, completed, targetAmountMinor: g.target_amount_minor, allocatedMinor: g.current_allocated_minor },
    })
  }
  return events
}

// ── 8. Consenso Open Banking in scadenza ─────────────────────────────────────────

interface ConnRow {
  id:           number
  aspsp_name:   string
  valid_until:  number | null
}

export function consentDeadlines(ctx: GenCtx): DeadlineEvent[] {
  const rows = sqlite.prepare(`
    SELECT id, aspsp_name, valid_until
    FROM eb_connections
    WHERE owner_id = ? AND status = 'active' AND valid_until IS NOT NULL
  `).all(ctx.userId) as ConnRow[]

  const events: DeadlineEvent[] = []
  for (const r of rows) {
    if (r.valid_until === null) continue
    const date = new Date(r.valid_until * 1000).toISOString().slice(0, 10)
    if (!inRange(date, ctx.from, ctx.to)) continue
    const days = Math.round((r.valid_until * 1000 - Date.parse(ctx.today)) / DAY_MS)
    events.push({
      date, source: 'consenso_banca', kind: 'opportunity', direction: 'none',
      label: `Consenso Open Banking in scadenza — ${r.aspsp_name}`,
      amountMinor: 0, confidence: 'certain',
      severity: days <= 7 ? 'warn' : 'opportunity',
      suggestion: 'Rinnova il consenso PSD2 o la sincronizzazione automatica dei movimenti si interromperà.',
      href: '/dashboard/settings',
      meta: { connectionId: r.id, daysUntil: days },
    })
  }
  return events
}

// ── 9. Tax-loss harvesting — deadline 31/12 ──────────────────────────────────────
// Evento aggregato: il beneficio a rischio (crediti in scadenza quest'anno). Il
// dettaglio operativo è demandato al layer insight (generateHarvestingRecommendations).

export function harvestingDeadline(ctx: GenCtx): DeadlineEvent[] {
  const atRisk = ctx.wallet.expiringThisYearMinor
  if (atRisk <= 0) return []
  const year = ctx.today.slice(0, 4)
  const date = `${year}-12-31`
  if (!inRange(date, ctx.from, ctx.to)) return []
  const days = Math.round((Date.parse(date) - Date.parse(ctx.today)) / DAY_MS)

  return [{
    date, source: 'harvesting', kind: 'opportunity', direction: 'none',
    label: 'Finestra tax-loss harvesting',
    amountMinor: atRisk, confidence: 'certain',
    severity: days <= 60 ? 'warn' : 'opportunity',
    suggestion: 'Realizza plusvalenze entro il 31/12 per assorbire i crediti in scadenza prima che vadano persi.',
    href: '/dashboard/tasse',
    meta: { daysUntil: days },
  }]
}

// ── 10. Franchigia crypto €2.000 — 31/12 ─────────────────────────────────────────

const CRYPTO_FRANCHISE_MINOR = 200_000  // €2.000

export function cryptoFranchiseDeadline(ctx: GenCtx): DeadlineEvent[] {
  if (!ctx.hasCrypto) return []
  const year = ctx.today.slice(0, 4)
  const date = `${year}-12-31`
  if (!inRange(date, ctx.from, ctx.to)) return []

  const realized = cryptoRealizedGainForYear(ctx.userId, year)
  const headroom = Math.max(0, CRYPTO_FRANCHISE_MINOR - realized)
  if (headroom <= 0) return []  // franchigia già esaurita: nessuna opportunità residua

  return [{
    date, source: 'franchigia_crypto',
    kind: 'opportunity', direction: 'none',
    label: 'Franchigia crypto residua',
    amountMinor: headroom, confidence: 'estimated',
    severity: 'opportunity',
    suggestion: 'Puoi realizzare plusvalenze crypto esentasse fino a questa soglia entro fine anno.',
    href: '/dashboard/tasse',
    meta: { realizedMinor: realized, franchiseMinor: CRYPTO_FRANCHISE_MINOR },
  }]
}

// ── 11. Interessi attivi conto (stima da interest_rate) ──────────────────────────

interface RateAccountRow {
  id:            number
  name:          string
  interest_rate: string | null
  balance_minor: number
}

export function interestDeadlines(ctx: GenCtx): DeadlineEvent[] {
  const rows = sqlite.prepare(`
    SELECT ba.id, ba.name, ba.interest_rate,
           CASE WHEN ba.anchor_balance_minor IS NOT NULL
             THEN ba.anchor_balance_minor
                  + COALESCE(SUM(CASE WHEN t.booked_date > ba.anchor_date THEN t.amount_minor END), 0)
             ELSE COALESCE(SUM(t.amount_minor), 0)
           END AS balance_minor
    FROM bank_accounts ba
    LEFT JOIN transactions t ON t.bank_account_id = ba.id
    WHERE ba.owner_id = ? AND ba.interest_rate IS NOT NULL AND ba.currency = 'EUR'
    GROUP BY ba.id
  `).all(ctx.userId) as RateAccountRow[]

  const year = ctx.today.slice(0, 4)
  const date = `${year}-12-31`
  if (!inRange(date, ctx.from, ctx.to)) return []

  const events: DeadlineEvent[] = []
  for (const r of rows) {
    const rate = parseFloat(r.interest_rate ?? '')
    if (!isFinite(rate) || rate <= 0 || r.balance_minor <= 0) continue
    // Interesse lordo annuo stimato meno ritenuta 26% → accredito netto stimato
    const gross = Math.round(r.balance_minor * (rate / 100))
    const net = Math.round(gross * 0.74)
    if (net < 100) continue  // sotto €1 non ha rilevanza
    events.push({
      date, source: 'interessi_conto', kind: 'cash', direction: 'in',
      label: `Interessi attivi stimati — ${r.name}`, amountMinor: net,
      confidence: 'estimated',
      meta: { accountId: r.id, ratePct: rate, grossMinor: gross },
    })
  }
  return events
}

// ── 12. Eventi personalizzati ────────────────────────────────────────────────────

interface CustomEventRow {
  id:           number
  date:         string
  label:        string
  amount_minor: number
  note:         string | null
}

export function customEventDeadlines(ctx: GenCtx): DeadlineEvent[] {
  const rows = sqlite.prepare(`
    SELECT id, date, label, amount_minor, note
    FROM calendar_events
    WHERE owner_id = ? AND date >= ? AND date <= ?
    ORDER BY date
  `).all(ctx.userId, ctx.from, ctx.to) as CustomEventRow[]

  return rows.map(r => ({
    id: r.id, date: r.date, source: 'custom' as const,
    kind: 'cash' as const, direction: 'out' as const,
    label: r.label, amountMinor: r.amount_minor, confidence: 'certain' as const,
    meta: r.note ? { note: r.note } : undefined,
  }))
}
