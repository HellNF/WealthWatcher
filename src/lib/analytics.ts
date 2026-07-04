// src/lib/analytics.ts — Aggregazioni statistiche avanzate su patrimonio e transazioni.
// Patrimonio: basato su valuation_snapshots (già storicizzata).
// Transazioni: query SQL raw su transactions, multi-mese.
import { sqlite } from '@/db'
import { listSnapshots } from '@/lib/valuation'

// ═══════════════════════════════════════════════════════════════════════════════
// PATRIMONIO
// ═══════════════════════════════════════════════════════════════════════════════

export interface GrowthPeriod {
  label:       string
  startDate:   string | null
  endDate:     string | null
  startMinor:  number | null
  endMinor:    number | null
  changeMinor: number | null   // endMinor - startMinor
  changePct:   number | null   // percentuale, può essere negativa
  cagrPct:     number | null   // rendimento annualizzato (null se periodo < 2 giorni)
}

export interface NetWorthStats {
  growth:      GrowthPeriod[]  // 1M, 3M, 6M, 1A, tutto
  allocationTimeSeries: AllocationPoint[]
  volatility:  VolatilityStats
  hasStaleSnapshots: boolean
}

export interface AllocationPoint {
  date:            string   // YYYY-MM-DD
  investments:     number   // minor
  accounts:        number
  otherAssets:     number
}

export interface VolatilityStats {
  bestMonthPct:    number | null  // max variazione % mese su mese positiva
  worstMonthPct:   number | null  // min variazione % mese su mese (negativa)
  maxDrawdownPct:  number | null  // max calo dai massimi storici, %
  stdDevMonthlyPct: number | null // deviazione standard rendimenti mensili
}

/** Calcola statistiche avanzate sul patrimonio netto dell'utente. */
export function netWorthStats(userId: number): NetWorthStats {
  const snapshots = listSnapshots(userId)
  const hasStaleSnapshots = snapshots.some((s) => s.stale === 1)

  if (snapshots.length < 2) {
    return {
      growth: buildGrowthPeriods([], new Date().toISOString().slice(0, 10)),
      allocationTimeSeries: [],
      volatility: { bestMonthPct: null, worstMonthPct: null, maxDrawdownPct: null, stdDevMonthlyPct: null },
      hasStaleSnapshots,
    }
  }

  const today   = snapshots.at(-1)!.date
  const growth  = buildGrowthPeriods(snapshots, today)
  const allocationTimeSeries = snapshots.map((s) => ({
    date:        s.date,
    investments: s.investments_eur_minor,
    accounts:    s.accounts_eur_minor,
    otherAssets: s.other_assets_eur_minor,
  }))
  const volatility = computeVolatility(snapshots)

  return { growth, allocationTimeSeries, volatility, hasStaleSnapshots }
}

function buildGrowthPeriods(
  snapshots: ReturnType<typeof listSnapshots>,
  today: string,
): GrowthPeriod[] {
  const periods = [
    { label: '1 mese',  days: 30 },
    { label: '3 mesi',  days: 90 },
    { label: '6 mesi',  days: 180 },
    { label: '1 anno',  days: 365 },
    { label: 'Tutto',   days: Infinity },
  ]

  const latest = snapshots.at(-1)

  return periods.map(({ label, days }) => {
    if (!latest) return { label, startDate: null, endDate: null, startMinor: null, endMinor: null, changeMinor: null, changePct: null, cagrPct: null }

    const cutoff = days === Infinity
      ? null
      : new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

    // Primo snapshot >= cutoff (o il più vecchio disponibile)
    const start = cutoff
      ? snapshots.find((s) => s.date >= cutoff) ?? snapshots[0]
      : snapshots[0]

    if (!start || start.date === latest.date) {
      return { label, startDate: null, endDate: null, startMinor: null, endMinor: null, changeMinor: null, changePct: null, cagrPct: null }
    }

    const changeMinor = latest.net_worth_eur_minor - start.net_worth_eur_minor
    const changePct   = start.net_worth_eur_minor !== 0
      ? Math.round((changeMinor / Math.abs(start.net_worth_eur_minor)) * 10_000) / 100
      : null

    const daysDiff = (Date.parse(latest.date) - Date.parse(start.date)) / 86_400_000
    let cagrPct: number | null = null
    if (daysDiff >= 2 && start.net_worth_eur_minor > 0 && latest.net_worth_eur_minor > 0) {
      const ratio = latest.net_worth_eur_minor / start.net_worth_eur_minor
      cagrPct = Math.round((Math.pow(ratio, 365 / daysDiff) - 1) * 10_000) / 100
    }

    return {
      label,
      startDate:   start.date,
      endDate:     latest.date,
      startMinor:  start.net_worth_eur_minor,
      endMinor:    latest.net_worth_eur_minor,
      changeMinor,
      changePct,
      cagrPct,
    }
  })
}

function computeVolatility(snapshots: ReturnType<typeof listSnapshots>): VolatilityStats {
  // Rendimenti mensili: prendiamo un snapshot per mese (l'ultimo del mese)
  const byMonth = new Map<string, number>()
  for (const s of snapshots) {
    const m = s.date.slice(0, 7)
    byMonth.set(m, s.net_worth_eur_minor) // sovrascrive con il più recente del mese
  }
  const months = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  if (months.length < 2) {
    return { bestMonthPct: null, worstMonthPct: null, maxDrawdownPct: null, stdDevMonthlyPct: null }
  }

  const monthlyReturns: number[] = []
  for (let i = 1; i < months.length; i++) {
    const prev = months[i - 1][1]
    const curr = months[i][1]
    if (prev > 0) monthlyReturns.push((curr - prev) / prev * 100)
  }

  const bestMonthPct  = monthlyReturns.length > 0 ? Math.max(...monthlyReturns) : null
  const worstMonthPct = monthlyReturns.length > 0 ? Math.min(...monthlyReturns) : null

  // Deviazione standard rendimenti mensili
  let stdDevMonthlyPct: number | null = null
  if (monthlyReturns.length >= 2) {
    const mean = monthlyReturns.reduce((a, b) => a + b, 0) / monthlyReturns.length
    const variance = monthlyReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / (monthlyReturns.length - 1)
    stdDevMonthlyPct = Math.round(Math.sqrt(variance) * 100) / 100
  }

  // Max drawdown sui valori giornalieri
  let maxDrawdownPct: number | null = null
  let peak = snapshots[0].net_worth_eur_minor
  let maxDD = 0
  for (const s of snapshots) {
    const v = s.net_worth_eur_minor
    if (v > peak) peak = v
    if (peak > 0) {
      const dd = (v - peak) / peak * 100
      if (dd < maxDD) maxDD = dd
    }
  }
  if (snapshots.length >= 2) maxDrawdownPct = Math.round(maxDD * 100) / 100

  return {
    bestMonthPct:     bestMonthPct !== null ? Math.round(bestMonthPct * 100) / 100 : null,
    worstMonthPct:    worstMonthPct !== null ? Math.round(worstMonthPct * 100) / 100 : null,
    maxDrawdownPct,
    stdDevMonthlyPct,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSAZIONI
// ═══════════════════════════════════════════════════════════════════════════════

export interface MonthlyCashflow {
  month:        string   // YYYY-MM
  inflow:       number   // minor, positivo
  outflow:      number   // minor, positivo (valore assoluto)
  net:          number   // minor, con segno
  savingsRate:  number | null  // (net / inflow) * 100, null se inflow = 0
}

export interface WeekdaySpending {
  weekday:     number  // 0 = Dom, 1 = Lun, …, 6 = Sab
  label:       string
  avgMinor:    number  // spesa media per quel giorno della settimana
  count:       number
}

export interface RecurringPayment {
  merchant_id:   number | null
  merchant_name: string | null
  description:   string        // fallback se no merchant
  monthlyMinor:  number        // importo medio mensile
  yearlyMinor:   number        // proiezione annuale
  months:        number        // numero di mesi in cui è apparso
}

export interface SpendingOutlier {
  id:            number
  booked_date:   string
  amount_minor:  number        // negativo
  description:   string
  category_name: string | null
  category_avg:  number        // media assoluta della categoria (minor)
  excess_pct:    number        // quanto sopra la media (%)
}

export interface TransactionStats {
  cashflow:     MonthlyCashflow[]
  weekday:      WeekdaySpending[]
  recurring:    RecurringPayment[]
  outliers:     SpendingOutlier[]
}

/** Calcola statistiche avanzate sulle transazioni dell'utente. */
export function transactionStats(userId: number): TransactionStats {
  return {
    cashflow:  monthlyCashflow(userId),
    weekday:   weekdaySpending(userId),
    recurring: recurringPayments(userId),
    outliers:  spendingOutliers(userId),
  }
}

// ── Cashflow mensile storico ──────────────────────────────────────────────────

function monthlyCashflow(userId: number): MonthlyCashflow[] {
  const rows = sqlite
    .prepare(
      `SELECT
         substr(booked_date, 1, 7) AS month,
         COALESCE(SUM(CASE WHEN amount_minor > 0 THEN  amount_minor ELSE 0 END), 0) AS inflow,
         COALESCE(SUM(CASE WHEN amount_minor < 0 THEN -amount_minor ELSE 0 END), 0) AS outflow
       FROM transactions
       WHERE owner_id = ?
       GROUP BY month
       ORDER BY month ASC`,
    )
    .all(userId) as { month: string; inflow: number; outflow: number }[]

  return rows.map((r) => ({
    month:       r.month,
    inflow:      r.inflow,
    outflow:     r.outflow,
    net:         r.inflow - r.outflow,
    savingsRate: r.inflow > 0
      ? Math.round(((r.inflow - r.outflow) / r.inflow) * 10_000) / 100
      : null,
  }))
}

// ── Pattern per giorno della settimana ───────────────────────────────────────

const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']

function weekdaySpending(userId: number): WeekdaySpending[] {
  const rows = sqlite
    .prepare(
      `SELECT
         CAST(strftime('%w', booked_date) AS INTEGER) AS weekday,
         COUNT(*) AS cnt,
         SUM(-amount_minor) AS total_minor
       FROM transactions
       WHERE owner_id = ?
         AND amount_minor < 0
       GROUP BY weekday
       ORDER BY weekday`,
    )
    .all(userId) as { weekday: number; cnt: number; total_minor: number }[]

  return rows.map((r) => ({
    weekday:  r.weekday,
    label:    WEEKDAY_LABELS[r.weekday] ?? String(r.weekday),
    avgMinor: r.cnt > 0 ? Math.round(r.total_minor / r.cnt) : 0,
    count:    r.cnt,
  }))
}

// ── Rilevamento pagamenti ricorrenti / abbonamenti ────────────────────────────
//
// Strategia: raggruppa per merchant_id (o, se assente, per normalized description)
// e conta su quanti mesi distinti appare il raggruppamento.
// Un pagamento è "ricorrente" se appare in ≥ 3 mesi diversi.

function recurringPayments(userId: number, minMonths = 3): RecurringPayment[] {
  // Merchants con ID noto
  const merchantRows = sqlite
    .prepare(
      `SELECT
         t.merchant_id,
         m.canonical_name AS merchant_name,
         COUNT(DISTINCT substr(t.booked_date, 1, 7)) AS month_count,
         COUNT(*) AS txn_count,
         ABS(AVG(t.amount_minor)) AS avg_minor
       FROM transactions t
       LEFT JOIN merchants m ON m.id = t.merchant_id
       WHERE t.owner_id = ?
         AND t.amount_minor < 0
         AND t.merchant_id IS NOT NULL
       GROUP BY t.merchant_id
       HAVING month_count >= ?
       ORDER BY avg_minor DESC
       LIMIT 20`,
    )
    .all(userId, minMonths) as {
      merchant_id:   number
      merchant_name: string | null
      month_count:   number
      txn_count:     number
      avg_minor:     number
    }[]

  // Transazioni senza merchant ma con descrizione stabile (ipotesi: se la descrizione
  // normalizzata appare nello stesso mese per ≥3 mesi distinti con importo simile)
  const descRows = sqlite
    .prepare(
      `SELECT
         lower(trim(description_raw)) AS desc_key,
         COUNT(DISTINCT substr(booked_date, 1, 7)) AS month_count,
         COUNT(*) AS txn_count,
         ABS(AVG(amount_minor)) AS avg_minor
       FROM transactions
       WHERE owner_id = ?
         AND amount_minor < 0
         AND merchant_id IS NULL
       GROUP BY desc_key
       HAVING month_count >= ?
         AND length(desc_key) > 4
       ORDER BY avg_minor DESC
       LIMIT 10`,
    )
    .all(userId, minMonths) as {
      desc_key:    string
      month_count: number
      txn_count:   number
      avg_minor:   number
    }[]

  const result: RecurringPayment[] = []

  for (const r of merchantRows) {
    const monthly = Math.round(r.avg_minor)
    result.push({
      merchant_id:   r.merchant_id,
      merchant_name: r.merchant_name,
      description:   r.merchant_name ?? 'Sconosciuto',
      monthlyMinor:  monthly,
      yearlyMinor:   monthly * 12,
      months:        r.month_count,
    })
  }

  for (const r of descRows) {
    const monthly = Math.round(r.avg_minor)
    // Tronca descrizione a 40 caratteri per display
    const label = r.desc_key.length > 40 ? r.desc_key.slice(0, 40) + '…' : r.desc_key
    result.push({
      merchant_id:   null,
      merchant_name: null,
      description:   label,
      monthlyMinor:  monthly,
      yearlyMinor:   monthly * 12,
      months:        r.month_count,
    })
  }

  // Ordina per importo mensile decrescente
  result.sort((a, b) => b.monthlyMinor - a.monthlyMinor)
  return result.slice(0, 20)
}

// ── Anomalie di spesa (outlier per categoria) ─────────────────────────────────
//
// Per ogni categoria calcola la media delle uscite; poi trova transazioni
// che superano del 200% la media (molto sopra la norma) con un importo
// minimo di 10€ per evitare micro-transazioni.

function spendingOutliers(userId: number, thresholdMultiplier = 3): SpendingOutlier[] {
  const rows = sqlite
    .prepare(
      `WITH cat_stats AS (
         SELECT
           category_id,
           ABS(AVG(amount_minor)) AS avg_abs,
           COUNT(*) AS cnt
         FROM transactions
         WHERE owner_id = ?
           AND amount_minor < 0
         GROUP BY category_id
         HAVING cnt >= 3
       )
       SELECT
         t.id,
         t.booked_date,
         t.amount_minor,
         t.description_raw AS description,
         c.name AS category_name,
         cs.avg_abs AS category_avg
       FROM transactions t
       JOIN cat_stats cs ON cs.category_id = t.category_id
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.owner_id = ?
         AND t.amount_minor < 0
         AND ABS(t.amount_minor) >= 1000              -- min 10€
         AND ABS(t.amount_minor) > cs.avg_abs * ?
       ORDER BY ABS(t.amount_minor) DESC
       LIMIT 15`,
    )
    .all(userId, userId, thresholdMultiplier) as {
      id:            number
      booked_date:   string
      amount_minor:  number
      description:   string
      category_name: string | null
      category_avg:  number
    }[]

  return rows.map((r) => ({
    ...r,
    excess_pct: Math.round(
      (Math.abs(r.amount_minor) / r.category_avg - 1) * 100,
    ),
  }))
}

// ── Spesa per giorno del mese ────────────────────────────────────────────────

export interface DaySpendingPoint {
  day:      number  // 1..31
  avgMinor: number  // media spesa totale in quel giorno del mese
  months:   number  // quanti mesi hanno dati per quel giorno
}

/** Media di spesa giornaliera per ogni giorno del mese (1-31). */
export function spendingCycleByDay(userId: number): DaySpendingPoint[] {
  const rows = sqlite
    .prepare(
      `SELECT
         CAST(day_str AS INTEGER) AS day_of_month,
         AVG(daily_total) AS avg_minor,
         COUNT(*) AS months
       FROM (
         SELECT
           substr(booked_date, 9, 2) AS day_str,
           substr(booked_date, 1, 7) AS month,
           SUM(-amount_minor) AS daily_total
         FROM transactions
         WHERE owner_id = ? AND amount_minor < 0
         GROUP BY day_str, month
       )
       GROUP BY day_of_month
       ORDER BY day_of_month`,
    )
    .all(userId) as { day_of_month: number; avg_minor: number; months: number }[]

  return rows.map((r) => ({
    day:      r.day_of_month,
    avgMinor: Math.round(r.avg_minor),
    months:   r.months,
  }))
}

// ═══════════════════════════════════════════════════════════════════════════════
// PIANIFICAZIONE & PROIEZIONI
// ═══════════════════════════════════════════════════════════════════════════════

// ── Helper condiviso ─────────────────────────────────────────────────────────

function avgMonthlySpendingMinor(userId: number, lookbackMonths = 12): number {
  const row = sqlite
    .prepare(
      `SELECT COALESCE(AVG(monthly_out), 0) AS avg
       FROM (
         SELECT SUM(-amount_minor) AS monthly_out
         FROM transactions
         WHERE owner_id = ?
           AND amount_minor < 0
           AND booked_date >= date('now', '-${lookbackMonths} months')
         GROUP BY substr(booked_date, 1, 7)
       )`,
    )
    .get(userId) as { avg: number }
  return Math.round(row?.avg ?? 0)
}

// ── Runway Index ─────────────────────────────────────────────────────────────

export interface RunwayScenario {
  label:        string
  monthlyMinor: number
  days:         number
  months:       number
}

export interface RunwayStats {
  liquidityMinor: number
  scenarios:      RunwayScenario[]
  hasData:        boolean
}

/**
 * Calcola quanti giorni di autonomia finanziaria garantisce la liquidità attuale
 * in tre scenari (spesa normale, survival, worst case).
 * `liquidityMinor` = saldo conti correnti in EUR minor units.
 */
export function runwayStats(userId: number, liquidityMinor: number): RunwayStats {
  const rows = sqlite
    .prepare(
      `SELECT SUM(-amount_minor) AS outflow
       FROM transactions
       WHERE owner_id = ?
         AND amount_minor < 0
         AND booked_date >= date('now', '-12 months')
       GROUP BY substr(booked_date, 1, 7)
       ORDER BY substr(booked_date, 1, 7)`,
    )
    .all(userId) as { outflow: number }[]

  if (rows.length === 0) return { liquidityMinor, scenarios: [], hasData: false }

  const amounts = rows.map((r) => r.outflow).sort((a, b) => a - b)
  const avg      = amounts.reduce((s, a) => s + a, 0) / amounts.length
  const survival = amounts[Math.floor(amounts.length * 0.25)] ?? amounts[0]
  const worst    = amounts[amounts.length - 1]

  function scenario(label: string, monthly: number): RunwayScenario {
    const days = monthly > 0 ? Math.round(liquidityMinor / monthly * 30) : 9999
    return { label, monthlyMinor: Math.round(monthly), days, months: Math.round(days / 30) }
  }

  return {
    liquidityMinor,
    hasData: true,
    scenarios: [
      scenario('Spesa normale',  avg),
      scenario('Survival mode',  survival),
      scenario('Worst case',     worst),
    ],
  }
}

// ── FI/RE Tracker ─────────────────────────────────────────────────────────────

export interface FireStats {
  annualExpensesMinor:     number
  fireNumberMinor:         number   // regola del 4%: spesa_annua / 0.04
  currentInvestmentsMinor: number
  progressPct:             number   // 0..100+
  yearsToFI:               number | null
  estimatedFIYear:         number | null
  annualNetMinor:          number   // risparmio netto annuo ultimi 12 mesi
  portfolioCAGRPct:        number | null
  hasData:                 boolean
}

/**
 * Stima la data di indipendenza finanziaria con la regola del 4%.
 * Se il portafoglio cresce al CAGR attuale con i risparmi correnti,
 * risolve n per: P*(1+r)^n + S*((1+r)^n - 1)/r = FV.
 */
export function fireStats(
  userId:                  number,
  currentInvestmentsMinor: number,
  portfolioCAGRPct:        number | null,
): FireStats {
  const monthlyExpenses = avgMonthlySpendingMinor(userId, 12)
  if (monthlyExpenses === 0) {
    return {
      annualExpensesMinor: 0, fireNumberMinor: 0, currentInvestmentsMinor,
      progressPct: 0, yearsToFI: null, estimatedFIYear: null,
      annualNetMinor: 0, portfolioCAGRPct, hasData: false,
    }
  }

  const annualExpenses = monthlyExpenses * 12
  const fireNumber     = Math.round(annualExpenses / 0.04)
  const progressPct    = Math.round(currentInvestmentsMinor / fireNumber * 100)

  // Risparmio netto ultimi 12 mesi
  const netRow = sqlite
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN amount_minor > 0 THEN  amount_minor ELSE 0 END), 0) -
         COALESCE(SUM(CASE WHEN amount_minor < 0 THEN -amount_minor ELSE 0 END), 0) AS net
       FROM transactions
       WHERE owner_id = ?
         AND booked_date >= date('now', '-12 months')`,
    )
    .get(userId) as { net: number }
  const annualNet = Math.max(0, netRow?.net ?? 0)

  // n = log((FV + S/r) / (P + S/r)) / log(1+r)  — formula somma geometrica
  let yearsToFI: number | null = null
  const r = (portfolioCAGRPct ?? 0) / 100
  const P = currentInvestmentsMinor
  const S = annualNet
  const FV = fireNumber

  if (P >= FV) {
    yearsToFI = 0
  } else if (r > 0.001) {
    const num = FV + S / r
    const den = P + S / r
    if (den > 0 && num / den > 1) {
      yearsToFI = Math.ceil(Math.log(num / den) / Math.log(1 + r))
    }
  } else if (S > 0) {
    yearsToFI = Math.ceil((FV - P) / S)
  }

  const estimatedFIYear = yearsToFI !== null
    ? new Date().getFullYear() + yearsToFI
    : null

  return {
    annualExpensesMinor:     annualExpenses,
    fireNumberMinor:         fireNumber,
    currentInvestmentsMinor,
    progressPct:             Math.min(progressPct, 999),
    yearsToFI,
    estimatedFIYear,
    annualNetMinor:          annualNet,
    portfolioCAGRPct,
    hasData:                 true,
  }
}

// ── Cash Drag ─────────────────────────────────────────────────────────────────

export interface CashDragStats {
  avgExcessLiquidityMinor: number    // eccesso medio sopra il buffer di 3 mesi
  emergencyBufferMinor:    number    // 3 mesi di spesa media (buffer consigliato)
  opportunityCostMinor:    number | null
  portfolioCAGRPct:        number | null
  periodYears:             number
  hasData:                 boolean
}

/**
 * Calcola il costo opportunità della liquidità "in eccesso" rispetto a un
 * fondo di emergenza di 3 mesi, usando il CAGR del portafoglio come benchmark.
 * `series` = allocationTimeSeries da netWorthStats (già in memoria, evita doppia query).
 */
export function cashDragStats(
  userId:           number,
  series:           AllocationPoint[],
  portfolioCAGRPct: number | null,
): CashDragStats {
  if (series.length < 2) {
    return { avgExcessLiquidityMinor: 0, emergencyBufferMinor: 0, opportunityCostMinor: null, portfolioCAGRPct, periodYears: 0, hasData: false }
  }

  const avgMonthlySpend  = avgMonthlySpendingMinor(userId, 12)
  const emergencyBuffer  = avgMonthlySpend * 3

  const excessValues = series.map((s) =>
    Math.max(0, s.accounts - emergencyBuffer),
  )
  const avgExcess = Math.round(excessValues.reduce((s, v) => s + v, 0) / excessValues.length)

  const first      = series[0].date
  const last       = series.at(-1)!.date
  const periodYears = (Date.parse(last) - Date.parse(first)) / (365.25 * 86_400_000)

  let opportunityCost: number | null = null
  if (portfolioCAGRPct !== null && avgExcess > 0 && periodYears > 0.1) {
    const r = portfolioCAGRPct / 100
    opportunityCost = Math.round(avgExcess * (Math.pow(1 + r, periodYears) - 1))
  }

  return {
    avgExcessLiquidityMinor: avgExcess,
    emergencyBufferMinor:    emergencyBuffer,
    opportunityCostMinor:    opportunityCost,
    portfolioCAGRPct,
    periodYears,
    hasData:                 avgExcess > 0 || emergencyBuffer > 0,
  }
}

// ── Lifestyle Creep ───────────────────────────────────────────────────────────

export interface LifestyleCreepPoint {
  month:   string
  inflow:  number
  outflow: number
}

export interface LifestyleCreepStats {
  months:           LifestyleCreepPoint[]
  incomeGrowthPct:  number | null  // crescita % mensile media entrate
  spendGrowthPct:   number | null  // crescita % mensile media uscite
  elasticity:       number | null  // rapporto slope_spend / slope_income (>1 = creep)
  verdict:          'creep' | 'stable' | 'improving' | 'insufficient_data'
  hasData:          boolean
}

function linearSlope(values: number[]): number {
  const n = values.length
  if (n < 2) return 0
  const meanX = (n - 1) / 2
  const meanY = values.reduce((s, v) => s + v, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY)
    den += (i - meanX) ** 2
  }
  return den === 0 ? 0 : num / den
}

/** Correlazione tra crescita delle entrate e delle uscite nel tempo. */
export function lifestyleCreepStats(userId: number): LifestyleCreepStats {
  const rows = sqlite
    .prepare(
      `SELECT
         substr(booked_date, 1, 7) AS month,
         COALESCE(SUM(CASE WHEN amount_minor > 0 THEN  amount_minor ELSE 0 END), 0) AS inflow,
         COALESCE(SUM(CASE WHEN amount_minor < 0 THEN -amount_minor ELSE 0 END), 0) AS outflow
       FROM transactions
       WHERE owner_id = ?
       GROUP BY month
       HAVING inflow > 0
       ORDER BY month ASC`,
    )
    .all(userId) as LifestyleCreepPoint[]

  if (rows.length < 6) {
    return { months: rows, incomeGrowthPct: null, spendGrowthPct: null, elasticity: null, verdict: 'insufficient_data', hasData: rows.length > 0 }
  }

  const incomes   = rows.map((r) => r.inflow)
  const spendings = rows.map((r) => r.outflow)

  const incomeSlope  = linearSlope(incomes)
  const spendSlope   = linearSlope(spendings)

  const avgIncome = incomes.reduce((s, v) => s + v, 0) / incomes.length
  const avgSpend  = spendings.reduce((s, v) => s + v, 0) / spendings.length

  const incomeGrowthPct = avgIncome > 0
    ? Math.round((incomeSlope / avgIncome) * 100 * 100) / 100
    : null
  const spendGrowthPct = avgSpend > 0
    ? Math.round((spendSlope / avgSpend) * 100 * 100) / 100
    : null

  const elasticity = incomeSlope !== 0
    ? Math.round((spendSlope / incomeSlope) * 100) / 100
    : null

  let verdict: LifestyleCreepStats['verdict'] = 'stable'
  if (elasticity !== null) {
    if (elasticity > 1.1)        verdict = 'creep'
    else if (elasticity < 0.5)   verdict = 'improving'
    else                         verdict = 'stable'
  }

  return {
    months:          rows,
    incomeGrowthPct,
    spendGrowthPct,
    elasticity,
    verdict,
    hasData:         true,
  }
}

// ── ROI Abbonamenti (costo opportunità) ────────────────────────────────────────

export interface RecurringWithCost extends RecurringPayment {
  yearly5yMinor: number | null   // valore proiettato se investito per 5 anni
}

/**
 * Arricchisce la lista di pagamenti ricorrenti con il costo opportunità
 * capitalizzato al CAGR del portafoglio dell'utente su 5 anni.
 */
export function recurringWithOpportunityCost(
  recurring:        RecurringPayment[],
  portfolioCAGRPct: number | null,
): RecurringWithCost[] {
  const r = (portfolioCAGRPct ?? 0) / 100

  return recurring.map((p) => {
    const annualMinor = p.monthlyMinor * 12
    let yearly5y: number | null = null
    if (r > 0.001) {
      // FV di una rendita annua: A * ((1+r)^5 - 1) / r
      yearly5y = Math.round(annualMinor * ((Math.pow(1 + r, 5) - 1) / r))
    } else {
      yearly5y = annualMinor * 5
    }
    return { ...p, yearly5yMinor: yearly5y }
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVESTIMENTI — MWRR (Money-Weighted Rate of Return / IRR)
// ═══════════════════════════════════════════════════════════════════════════════

export interface PortfolioMWRRResult {
  portfolioId:   number
  portfolioName: string
  currency:      string
  mwrrPct:       number | null   // IRR annualizzato %, null se non calcolabile
  periodYears:   number
  txnCount:      number
  currentValueMinor: number | null
}

/**
 * Calcola il MWRR (IRR annualizzato) per ogni portafoglio dell'utente.
 * Usa il metodo della bisezione su: NPV(r) = Σ cashflow_i / (1+r)^t_i = 0
 * dove t_i è in anni dalla prima transazione.
 *
 * Convenzione cashflow:
 *   buy  → negativo (denaro uscito dal conto investitore)
 *   sell → positivo (denaro rientrato)
 *   dividend → positivo
 *   fee  → negativo
 * Il valore di mercato attuale è l'ultimo cashflow positivo.
 */
export function portfolioMWRR(userId: number): PortfolioMWRRResult[] {
  // Leggo tutte le txn di investimento con cashflow calcolato
  const txnRows = sqlite
    .prepare(
      `SELECT
         it.portfolio_id,
         ip.name AS portfolio_name,
         ip.currency,
         it.trade_date,
         it.type,
         CASE
           WHEN it.type = 'buy'
             THEN -(CAST(it.quantity AS REAL) * CAST(it.unit_price AS REAL) * 100
                    + COALESCE(it.fee_minor, 0))
           WHEN it.type = 'sell'
             THEN  (CAST(it.quantity AS REAL) * CAST(it.unit_price AS REAL) * 100
                    - COALESCE(it.fee_minor, 0))
           WHEN it.type = 'dividend'
             THEN COALESCE(it.amount_minor, 0)
           WHEN it.type = 'fee'
             THEN -COALESCE(it.amount_minor, 0)
           ELSE 0
         END AS cashflow_minor
       FROM investment_txns it
       JOIN investment_portfolios ip ON ip.id = it.portfolio_id
       WHERE ip.owner_id = ?
         AND (it.quantity IS NOT NULL OR it.amount_minor IS NOT NULL)
       ORDER BY it.portfolio_id, it.trade_date ASC, it.id ASC`,
    )
    .all(userId) as {
      portfolio_id:   number
      portfolio_name: string
      currency:       string
      trade_date:     string
      type:           string
      cashflow_minor: number
    }[]

  // Valore di mercato attuale per portafoglio (last snapshot accounts di portafoglio)
  const marketValueRows = sqlite
    .prepare(
      `SELECT
         portfolio_id,
         SUM(ABS(last_price * CAST(quantity AS REAL) * 100)) AS market_value_minor
       FROM (
         SELECT
           it.portfolio_id,
           it.instrument_id,
           SUM(CASE WHEN it.type = 'buy'  THEN  CAST(it.quantity AS REAL)
                    WHEN it.type = 'sell' THEN -CAST(it.quantity AS REAL)
                    ELSE 0 END) AS quantity,
           i.last_price
         FROM investment_txns it
         JOIN investment_portfolios ip ON ip.id = it.portfolio_id
         JOIN instruments i ON i.id = it.instrument_id
         WHERE ip.owner_id = ?
           AND it.quantity IS NOT NULL
         GROUP BY it.portfolio_id, it.instrument_id
         HAVING quantity > 0
       )
       GROUP BY portfolio_id`,
    )
    .all(userId) as { portfolio_id: number; market_value_minor: number }[]

  const marketByPortfolio = new Map<number, number>()
  for (const r of marketValueRows) {
    marketByPortfolio.set(r.portfolio_id, r.market_value_minor)
  }

  // Raggruppa per portafoglio
  const byPortfolio = new Map<number, (typeof txnRows)>()
  for (const row of txnRows) {
    const list = byPortfolio.get(row.portfolio_id) ?? []
    list.push(row)
    byPortfolio.set(row.portfolio_id, list)
  }

  const results: PortfolioMWRRResult[] = []

  for (const [portfolioId, txns] of byPortfolio) {
    if (txns.length < 2) continue
    const info = txns[0]
    const currentValue = marketByPortfolio.get(portfolioId) ?? null

    const cashflows = txns.map((t) => ({ date: t.trade_date, amount: t.cashflow_minor }))
    const today     = new Date().toISOString().slice(0, 10)
    if (currentValue && currentValue > 0) {
      cashflows.push({ date: today, amount: currentValue })
    }

    const t0 = Date.parse(cashflows[0].date)
    const tLast = Date.parse(cashflows.at(-1)!.date)
    const periodYears = (tLast - t0) / (365.25 * 86_400_000)

    const mwrr = periodYears > 0.05 ? bisectionIRR(cashflows) : null

    results.push({
      portfolioId,
      portfolioName: info.portfolio_name,
      currency:      info.currency,
      mwrrPct:       mwrr !== null ? Math.round(mwrr * 10_000) / 100 : null,
      periodYears:   Math.round(periodYears * 10) / 10,
      txnCount:      txns.length,
      currentValueMinor: currentValue,
    })
  }

  return results
}

// ═══════════════════════════════════════════════════════════════════════════════
// EFFETTO RICCHEZZA — Correlazione Pearson patrimonio↔spesa (mese successivo)
// ═══════════════════════════════════════════════════════════════════════════════

export interface WealthEffectStats {
  correlation:    number | null   // Pearson r, −1..1
  verdict:        'positive' | 'negative' | 'neutral' | 'insufficient_data'
  monthsAnalyzed: number
  hasData:        boolean
}

function pearsonR(xs: number[], ys: number[]): number | null {
  const n = xs.length
  if (n < 5) return null
  const mx = xs.reduce((s, v) => s + v, 0) / n
  const my = ys.reduce((s, v) => s + v, 0) / n
  let num = 0, dx2 = 0, dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy
  }
  const den = Math.sqrt(dx2 * dy2)
  return den === 0 ? null : Math.round(num / den * 1000) / 1000
}

/**
 * Pearson r tra la variazione mensile del patrimonio in mese T
 * e la variazione della spesa in mese T+1.
 * X usa il "rendimento puro" del portafoglio: variazione NW netto dei risparmi del mese,
 * così si isola l'effetto mercato e si esclude il denaro appena depositato.
 */
export function wealthEffectStats(
  snapshots: AllocationPoint[],
  cashflow:  MonthlyCashflow[],
): WealthEffectStats {
  // NW per mese (ultimo snapshot sovrascrive)
  const nwByMonth = new Map<string, number>()
  for (const s of snapshots) {
    const m = s.date.slice(0, 7)
    nwByMonth.set(m, s.investments + s.accounts + s.otherAssets)
  }

  const savingsByMonth = new Map<string, number>()
  for (const c of cashflow) savingsByMonth.set(c.month, c.net)

  const spendByMonth = new Map<string, number>()
  for (const c of cashflow) spendByMonth.set(c.month, c.outflow)

  const months = [...nwByMonth.keys()].sort()
  const xs: number[] = []
  const ys: number[] = []

  for (let i = 1; i < months.length - 1; i++) {
    const m     = months[i]
    const mPrev = months[i - 1]
    const mNext = months[i + 1]

    const nw_t    = nwByMonth.get(m)
    const nw_prev = nwByMonth.get(mPrev)
    const spend_t    = spendByMonth.get(m)
    const spend_next = spendByMonth.get(mNext)

    if (!nw_t || !nw_prev || nw_prev <= 0 || !spend_t || spend_t <= 0 || !spend_next) continue

    // Rendimento puro = variazione NW − risparmio netto del mese (denaro fresco)
    const netSavings = savingsByMonth.get(m) ?? 0
    const marketReturn = (nw_t - nw_prev - netSavings) / nw_prev * 100

    const spendChange = (spend_next - spend_t) / spend_t * 100

    xs.push(marketReturn)
    ys.push(spendChange)
  }

  if (xs.length < 6) {
    return { correlation: null, verdict: 'insufficient_data', monthsAnalyzed: xs.length, hasData: false }
  }

  const r = pearsonR(xs, ys)
  const verdict: WealthEffectStats['verdict'] =
    r === null    ? 'insufficient_data'
    : r > 0.3    ? 'positive'
    : r < -0.3   ? 'negative'
    : 'neutral'

  return { correlation: r, verdict, monthsAnalyzed: xs.length, hasData: r !== null }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRIGGER DI SPESA — Affinity Analysis tra categorie (finestra 72 ore)
// ═══════════════════════════════════════════════════════════════════════════════

export interface AffinityPair {
  catA:           { id: number; name: string; color: string | null }
  catB:           { id: number; name: string; color: string | null }
  probability:    number  // P(B entro 72h | A), 0..1
  coOccurrences:  number
  avgBSpendMinor: number
}

/**
 * Trova le coppie di categorie in cui la spesa in A tende a precedere
 * entro 72 ore una spesa in B con probabilità ≥ 20% e ≥ 3 co-occorrenze.
 * Lookback: 24 mesi per limitare la durata della self-join.
 */
export function affinityStats(userId: number): AffinityPair[] {
  const rows = sqlite
    .prepare(
      `WITH cat_totals AS (
         SELECT category_id, COUNT(*) AS total_count
         FROM transactions
         WHERE owner_id = ? AND amount_minor < 0 AND category_id IS NOT NULL
           AND booked_date >= date('now', '-24 months')
         GROUP BY category_id
       ),
       pairs AS (
         SELECT
           t1.category_id AS a_id,
           t2.category_id AS b_id,
           ABS(t2.amount_minor) AS b_amount
         FROM transactions t1
         JOIN transactions t2
           ON  t2.owner_id = t1.owner_id
           AND t2.id != t1.id
           AND t2.category_id != t1.category_id
           AND t2.amount_minor < 0
           AND julianday(t2.booked_date) BETWEEN julianday(t1.booked_date)
               AND julianday(t1.booked_date) + 3
         WHERE t1.owner_id = ?
           AND t1.amount_minor < 0
           AND t1.category_id IS NOT NULL
           AND t2.category_id IS NOT NULL
           AND t1.booked_date >= date('now', '-24 months')
       )
       SELECT
         p.a_id, ca.name AS a_name, ca.color AS a_color,
         p.b_id, cb.name AS b_name, cb.color AS b_color,
         COUNT(*) AS co_occ,
         ct.total_count AS total_a,
         AVG(p.b_amount) AS avg_b_minor
       FROM pairs p
       JOIN categories ca ON ca.id = p.a_id
       JOIN categories cb ON cb.id = p.b_id
       JOIN cat_totals ct ON ct.category_id = p.a_id
       WHERE ct.total_count >= 3
       GROUP BY p.a_id, p.b_id
       HAVING co_occ >= 3
         AND CAST(co_occ AS REAL) / ct.total_count >= 0.20
       ORDER BY CAST(co_occ AS REAL) / ct.total_count DESC
       LIMIT 8`,
    )
    .all(userId, userId) as Array<{
      a_id: number; a_name: string; a_color: string | null
      b_id: number; b_name: string; b_color: string | null
      co_occ: number; total_a: number; avg_b_minor: number
    }>

  return rows.map((r) => ({
    catA: { id: r.a_id, name: r.a_name, color: r.a_color },
    catB: { id: r.b_id, name: r.b_name, color: r.b_color },
    probability:    Math.round(r.co_occ / r.total_a * 100) / 100,
    coOccurrences:  r.co_occ,
    avgBSpendMinor: Math.round(r.avg_b_minor),
  }))
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRESS TEST DECUMULO — Speranza di vita del capitale
// ═══════════════════════════════════════════════════════════════════════════════

export interface DecumuloStats {
  currentNetWorthMinor:    number
  avgMonthlyExpensesMinor: number
  portfolioCAGRPct:        number | null
  maxDrawdownPct:          number | null  // negativo, es. -15.3
  /** null = portafoglio sostenibile a lungo termine (crescita > prelievi) */
  normalSurvivalYears:     number | null
  stressedNetWorthMinor:   number | null
  /** null = sostenibile anche dopo il drawdown */
  stressedSurvivalYears:   number | null
  hasData:                 boolean
}

/**
 * Simula per quanti anni il patrimonio sostiene la spesa corrente in due scenari:
 *  A) crescita al CAGR storico, nessun drawdown
 *  B) drawdown massimo storico applicato immediatamente, poi crescita al CAGR
 */
export function decumuloStats(
  userId:               number,
  currentNetWorthMinor: number,
  maxDrawdownPct:       number | null,
  portfolioCAGRPct:     number | null,
): DecumuloStats {
  const monthlyExp = avgMonthlySpendingMinor(userId, 12)

  if (monthlyExp === 0 || currentNetWorthMinor <= 0) {
    return {
      currentNetWorthMinor, avgMonthlyExpensesMinor: monthlyExp,
      portfolioCAGRPct, maxDrawdownPct,
      normalSurvivalYears: null, stressedNetWorthMinor: null, stressedSurvivalYears: null,
      hasData: false,
    }
  }

  function survivalYears(initialMinor: number): number | null {
    const monthlyReturn = portfolioCAGRPct
      ? Math.pow(1 + portfolioCAGRPct / 100, 1 / 12) - 1
      : 0
    let worth = initialMinor
    for (let m = 0; m < 1200; m++) {
      if (worth <= 0) return Math.round(m / 12 * 10) / 10
      worth = worth * (1 + monthlyReturn) - monthlyExp
    }
    return null  // sostenibile (es. rendimento > spesa)
  }

  const normalSurvival = survivalYears(currentNetWorthMinor)

  // maxDrawdownPct è negativo (es. −15.3 → −15.3%)
  const stressedNW = maxDrawdownPct !== null
    ? Math.round(currentNetWorthMinor * (1 + maxDrawdownPct / 100))
    : null
  const stressedSurvival = stressedNW !== null ? survivalYears(stressedNW) : null

  return {
    currentNetWorthMinor,
    avgMonthlyExpensesMinor: monthlyExp,
    portfolioCAGRPct,
    maxDrawdownPct,
    normalSurvivalYears:   normalSurvival,
    stressedNetWorthMinor: stressedNW,
    stressedSurvivalYears: stressedSurvival,
    hasData:               true,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREVEDIBILITÀ CASHFLOW — Coefficiente di variazione del flusso netto mensile
// ═══════════════════════════════════════════════════════════════════════════════

export interface CashflowVariabilityStats {
  cv:                      number | null  // stddev / |mean|
  stdDevMinor:             number | null
  meanNetMinor:            number | null
  verdict:                 'stable' | 'moderate' | 'chaotic' | 'insufficient_data'
  recommendedBufferMonths: number   // mesi di liquidità consigliati in base al CV
  monthsAnalyzed:          number
  hasData:                 boolean
}

/**
 * Misura quanto è prevedibile il flusso di cassa netto mensile.
 * CV = σ / |μ|: vicino a 0 = orologio svizzero; > 0.7 = caotico.
 * Prende il cashflow già calcolato per evitare una query duplicata.
 */
export function cashflowVariabilityStats(cashflow: MonthlyCashflow[]): CashflowVariabilityStats {
  if (cashflow.length < 6) {
    return {
      cv: null, stdDevMinor: null, meanNetMinor: null,
      verdict: 'insufficient_data', recommendedBufferMonths: 3,
      monthsAnalyzed: cashflow.length, hasData: false,
    }
  }

  const nets = cashflow.map((c) => c.net)
  const mean = nets.reduce((s, v) => s + v, 0) / nets.length
  const variance = nets.reduce((s, v) => s + (v - mean) ** 2, 0) / (nets.length - 1)
  const stdDev = Math.sqrt(variance)
  const cv = mean !== 0 ? stdDev / Math.abs(mean) : null

  let verdict: CashflowVariabilityStats['verdict']
  let bufferMonths: number
  if (cv === null) {
    verdict = 'insufficient_data'; bufferMonths = 3
  } else if (cv < 0.3) {
    verdict = 'stable'; bufferMonths = 3
  } else if (cv < 0.7) {
    verdict = 'moderate'; bufferMonths = 4
  } else {
    verdict = 'chaotic'; bufferMonths = 6
  }

  return {
    cv:                      cv !== null ? Math.round(cv * 100) / 100 : null,
    stdDevMinor:             Math.round(stdDev),
    meanNetMinor:            Math.round(mean),
    verdict,
    recommendedBufferMonths: bufferMonths,
    monthsAnalyzed:          cashflow.length,
    hasData:                 true,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DCA COUNTERFACTUAL — Timing reale vs investimento mensile automatico
// ═══════════════════════════════════════════════════════════════════════════════

export interface DCAInstrumentResult {
  instrumentId:     number
  symbol:           string
  name:             string
  currency:         string
  firstBuyDate:     string
  years:            number
  totalCostMinor:   number        // totale acquistato (valuta strumento × 100)
  totalBoughtQty:   number        // quote totali acquistate
  actualValueMinor: number | null // valore attuale delle quote acquistate
  dcaValueMinor:    number | null // valore che avrebbe dato il DCA
  actualCAGR:       number | null // %/anno
  dcaCAGR:          number | null
  diffPct:          number | null // actualCAGR − dcaCAGR: > 0 = utente ha battuto DCA
  hasHistory:       boolean
}

export interface DCAStats {
  results:     DCAInstrumentResult[]
  hasData:     boolean
  hasBuyTxns:  boolean
}

/**
 * Per ogni strumento acquistato: confronta il rendimento reale con quello che si sarebbe
 * ottenuto investendo la stessa somma totale in rate mensili uguali (DCA puro).
 * Richiede dati in price_history (disponibili dopo il backfill dalla pagina portafoglio).
 */
export function dcaCounterfactualStats(userId: number): DCAStats {
  const instrRows = sqlite
    .prepare(
      `SELECT
         it.instrument_id,
         i.symbol, i.name, i.currency, i.last_price,
         MIN(it.trade_date) AS first_date,
         SUM(CAST(it.quantity AS REAL)) AS total_bought_qty,
         SUM(CAST(it.quantity AS REAL) * CAST(it.unit_price AS REAL) * 100) AS total_cost_minor
       FROM investment_txns it
       JOIN instruments i ON i.id = it.instrument_id
       JOIN investment_portfolios ip ON ip.id = it.portfolio_id
       WHERE ip.owner_id = ?
         AND it.type = 'buy'
         AND it.quantity IS NOT NULL
         AND it.unit_price IS NOT NULL
       GROUP BY it.instrument_id
       HAVING total_bought_qty > 0`,
    )
    .all(userId) as Array<{
      instrument_id: number; symbol: string; name: string
      currency: string; last_price: string | null
      first_date: string; total_bought_qty: number; total_cost_minor: number
    }>

  const hasBuyTxns = instrRows.length > 0
  if (!hasBuyTxns) return { results: [], hasData: false, hasBuyTxns: false }

  const today = new Date().toISOString().slice(0, 10)
  const results: DCAInstrumentResult[] = []

  for (const instr of instrRows) {
    const years = (Date.parse(today) - Date.parse(instr.first_date)) / (365.25 * 86_400_000)
    if (years < 0.25) continue

    const priceRows = sqlite
      .prepare(
        `SELECT date, CAST(price AS REAL) AS price
         FROM price_history
         WHERE instrument_id = ? AND date >= ? AND date <= ?
         ORDER BY date ASC`,
      )
      .all(instr.instrument_id, instr.first_date, today) as Array<{ date: string; price: number }>

    const currentPrice  = instr.last_price ? parseFloat(instr.last_price) : null
    const totalCostMinor = Math.round(instr.total_cost_minor)
    const actualValueMinor = currentPrice
      ? Math.round(instr.total_bought_qty * currentPrice * 100)
      : null

    if (priceRows.length < 3 || !currentPrice) {
      results.push({
        instrumentId: instr.instrument_id, symbol: instr.symbol, name: instr.name,
        currency: instr.currency, firstBuyDate: instr.first_date,
        years: Math.round(years * 10) / 10, totalCostMinor,
        totalBoughtQty: instr.total_bought_qty,
        actualValueMinor, dcaValueMinor: null,
        actualCAGR: null, dcaCAGR: null, diffPct: null, hasHistory: false,
      })
      continue
    }

    // Genera mesi dal primo acquisto a oggi
    const months: string[] = []
    let d = new Date(instr.first_date)
    d = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(today)
    while (d <= end) {
      months.push(d.toISOString().slice(0, 10))
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    }
    if (months.length === 0) continue

    // Ricerca binaria del prezzo più vicino alla data target (max 15 giorni di gap)
    function closestPrice(targetDate: string): number | null {
      const tMs = Date.parse(targetDate)
      let lo = 0, hi = priceRows.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (Date.parse(priceRows[mid].date) < tMs) lo = mid + 1
        else hi = mid
      }
      const candidates = [priceRows[lo], lo > 0 ? priceRows[lo - 1] : null].filter(Boolean) as typeof priceRows
      if (!candidates.length) return null
      const best = candidates.reduce((a, b) =>
        Math.abs(Date.parse(a.date) - tMs) <= Math.abs(Date.parse(b.date) - tMs) ? a : b,
      )
      return Math.abs(Date.parse(best.date) - tMs) <= 15 * 86_400_000 ? best.price : null
    }

    // Simulazione DCA: stessa somma totale divisa in rate mensili uguali
    const monthlyAmountCurrency = totalCostMinor / 100 / months.length
    let dcaTotalQty = 0, validMonths = 0
    for (const m of months) {
      const price = closestPrice(m)
      if (price && price > 0) {
        dcaTotalQty += monthlyAmountCurrency / price
        validMonths++
      }
    }

    if (validMonths < Math.max(2, months.length * 0.3)) {
      results.push({
        instrumentId: instr.instrument_id, symbol: instr.symbol, name: instr.name,
        currency: instr.currency, firstBuyDate: instr.first_date,
        years: Math.round(years * 10) / 10, totalCostMinor,
        totalBoughtQty: instr.total_bought_qty,
        actualValueMinor, dcaValueMinor: null,
        actualCAGR: null, dcaCAGR: null, diffPct: null, hasHistory: false,
      })
      continue
    }

    const dcaValueMinor = Math.round(dcaTotalQty * currentPrice * 100)

    function cagrPct(finalV: number, initV: number, yrs: number): number | null {
      if (initV <= 0 || finalV <= 0 || yrs < 0.1) return null
      return Math.round((Math.pow(finalV / initV, 1 / yrs) - 1) * 10_000) / 100
    }

    const actualCAGR = actualValueMinor ? cagrPct(actualValueMinor, totalCostMinor, years) : null
    const dcaCAGR    = cagrPct(dcaValueMinor, totalCostMinor, years)
    const diffPct    = actualCAGR !== null && dcaCAGR !== null
      ? Math.round((actualCAGR - dcaCAGR) * 100) / 100
      : null

    results.push({
      instrumentId: instr.instrument_id, symbol: instr.symbol, name: instr.name,
      currency: instr.currency, firstBuyDate: instr.first_date,
      years: Math.round(years * 10) / 10, totalCostMinor,
      totalBoughtQty: instr.total_bought_qty,
      actualValueMinor, dcaValueMinor,
      actualCAGR, dcaCAGR, diffPct, hasHistory: true,
    })
  }

  return {
    results: results.filter((r) => r.years >= 0.25),
    hasData: results.length > 0,
    hasBuyTxns,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CASHFLOW FORECAST — proiezione a 30/60 giorni
// ═══════════════════════════════════════════════════════════════════════════════

export interface CashflowForecastStats {
  hasData:                  boolean
  avgMonthlyInflowMinor:    number
  avgMonthlyOutflowMinor:   number
  avgMonthlyNetMinor:       number   // negativo = spesa netta
  proj30Minor:              number   // saldo proiettato tra 30 giorni
  proj60Minor:              number   // saldo proiettato tra 60 giorni
  thresholdMinor:           number   // 1 mese di spesa media (soglia di allerta)
  crossesThresholdInDays:   number | null  // null = non scende sotto la soglia entro 60 gg
  recurringOutflowMonthly:  number   // totale uscite ricorrenti rilevate/mese
  /** Quota mensile delle imposte patrimoniali annue (bollo+IVAFE), se nota */
  wealthTaxMonthlyMinor:    number
}

/**
 * Proietta il saldo liquido nei prossimi 30/60 giorni usando la media delle
 * ultime 3 mensilità e i pagamenti ricorrenti già rilevati.
 * Input: cashflow storico, ricorrenti e saldo liquido corrente in EUR.
 *
 * @param annualWealthTaxMinor  imposta patrimoniale annua stimata (bollo+IVAFE) in EUR minor.
 *                              Default 0 → comportamento invariato (retro-compatibile).
 */
export function cashflowForecastStats(
  cashflow:              MonthlyCashflow[],
  recurring:             RecurringPayment[],
  liquidityMinor:        number,
  annualWealthTaxMinor = 0,
): CashflowForecastStats {
  const empty: CashflowForecastStats = {
    hasData: false, avgMonthlyInflowMinor: 0, avgMonthlyOutflowMinor: 0,
    avgMonthlyNetMinor: 0, proj30Minor: liquidityMinor, proj60Minor: liquidityMinor,
    thresholdMinor: 0, crossesThresholdInDays: null, recurringOutflowMonthly: 0,
    wealthTaxMonthlyMinor: 0,
  }
  if (cashflow.length < 2) return empty

  const window = cashflow.slice(-3)  // ultimi 3 mesi disponibili
  const avgInflow  = Math.round(window.reduce((s, m) => s + m.inflow,  0) / window.length)
  const avgOutflow = Math.round(window.reduce((s, m) => s + m.outflow, 0) / window.length)
  const avgNet     = avgInflow - avgOutflow  // negativo = spesa netta mensile

  const recurringOut = recurring.reduce((s, r) => s + r.monthlyMinor, 0)

  // Quota mensile delle imposte patrimoniali (spalmate su 12 mesi)
  const wealthTaxMonthly = Math.round(annualWealthTaxMinor / 12)

  // Proiezioni: include la quota mensile del bollo/IVAFE
  const proj30 = liquidityMinor + avgNet - wealthTaxMonthly
  const proj60 = liquidityMinor + avgNet * 2 - wealthTaxMonthly * 2
  const threshold = avgOutflow  // 1 mese di spese come soglia di allerta

  // Calcola il giorno in cui il saldo scende sotto la soglia (interpolazione lineare)
  let crossDay: number | null = null
  const effectiveDailyNet = (avgNet - wealthTaxMonthly) / 30
  if (effectiveDailyNet < 0) {
    const daysToThreshold = (liquidityMinor - threshold) / -effectiveDailyNet
    if (daysToThreshold > 0 && daysToThreshold <= 60) {
      crossDay = Math.round(daysToThreshold)
    }
  }

  return {
    hasData: true,
    avgMonthlyInflowMinor:   avgInflow,
    avgMonthlyOutflowMinor:  avgOutflow,
    avgMonthlyNetMinor:      avgNet,
    proj30Minor:             proj30,
    proj60Minor:             proj60,
    thresholdMinor:          threshold,
    crossesThresholdInDays:  crossDay,
    recurringOutflowMonthly: recurringOut,
    wealthTaxMonthlyMinor:   wealthTaxMonthly,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DCA RECOMMENDER — distribuzione proporzionale della liquidità in eccesso
// ═══════════════════════════════════════════════════════════════════════════════

export interface DCARecommendation {
  instrumentId:    number
  symbol:          string
  name:            string
  cluster:         string
  currency:        string
  costBasisMinor:  number
  pctOfPortfolio:  number   // % del costo totale investito
  suggestedMinor:  number   // quota da investire (pct × excessCash)
}

export interface DCARecommendationStats {
  hasData:          boolean
  excessCashMinor:  number
  emergencyBufferMinor: number
  totalCostMinor:   number
  recommendations:  DCARecommendation[]
}

export function dcaRecommendationStats(
  userId:          number,
  liquidityMinor:  number,  // liquidità corrente in EUR (da snapshot)
  cashflow:        MonthlyCashflow[],
): DCARecommendationStats {
  const empty: DCARecommendationStats = {
    hasData: false, excessCashMinor: 0, emergencyBufferMinor: 0,
    totalCostMinor: 0, recommendations: [],
  }

  // Calcola buffer di emergenza (3 mesi di spesa media)
  const window = cashflow.slice(-12).filter(m => m.outflow > 0)
  if (window.length === 0) return empty
  const avgMonthlyOutflow = window.reduce((s, m) => s + m.outflow, 0) / window.length
  const emergencyBuffer   = Math.round(avgMonthlyOutflow * 3)
  const excessCash        = Math.max(0, liquidityMinor - emergencyBuffer)
  if (excessCash < 100_00) return { ...empty, emergencyBufferMinor: emergencyBuffer }  // < €100 in eccesso

  // Raccoglie tutte le posizioni attive su tutti i portafogli dell'utente
  const instrRows = sqlite.prepare(`
    SELECT
      i.id AS instrument_id,
      i.symbol, i.name, i.cluster, i.currency,
      SUM(
        CASE WHEN it.type = 'buy' THEN
          CAST(it.quantity AS REAL) * CAST(it.unit_price AS REAL) * 100 + it.fee_minor
        WHEN it.type = 'sell' THEN
          -(CAST(it.quantity AS REAL) * CAST(it.unit_price AS REAL) * 100 - it.fee_minor)
        ELSE 0 END
      ) AS cost_basis_minor,
      SUM(
        CASE WHEN it.type = 'buy'  THEN  CAST(it.quantity AS REAL)
             WHEN it.type = 'sell' THEN -CAST(it.quantity AS REAL)
             ELSE 0 END
      ) AS net_qty
    FROM investment_txns it
    JOIN instruments i ON i.id = it.instrument_id
    JOIN investment_portfolios ip ON ip.id = it.portfolio_id
    WHERE ip.owner_id = ?
      AND it.quantity IS NOT NULL AND it.unit_price IS NOT NULL
    GROUP BY i.id
    HAVING net_qty > 0.0001 AND cost_basis_minor > 0
    ORDER BY cost_basis_minor DESC
  `).all(userId) as Array<{
    instrument_id: number; symbol: string; name: string; cluster: string; currency: string
    cost_basis_minor: number; net_qty: number
  }>

  if (instrRows.length === 0) return { ...empty, emergencyBufferMinor: emergencyBuffer, excessCashMinor: excessCash }

  const totalCost = instrRows.reduce((s, r) => s + r.cost_basis_minor, 0)
  if (totalCost <= 0) return empty

  const recommendations: DCARecommendation[] = instrRows.map(r => {
    const pct       = r.cost_basis_minor / totalCost
    const suggested = Math.round(excessCash * pct)
    return {
      instrumentId:   r.instrument_id,
      symbol:         r.symbol,
      name:           r.name,
      cluster:        r.cluster,
      currency:       r.currency,
      costBasisMinor: Math.round(r.cost_basis_minor),
      pctOfPortfolio: Math.round(pct * 1000) / 10,
      suggestedMinor: suggested,
    }
  }).filter(r => r.suggestedMinor >= 1_00)  // mostra solo suggerimenti ≥ €1

  if (recommendations.length === 0) return { ...empty, emergencyBufferMinor: emergencyBuffer, excessCashMinor: excessCash }

  return {
    hasData:              true,
    excessCashMinor:      excessCash,
    emergencyBufferMinor: emergencyBuffer,
    totalCostMinor:       totalCost,
    recommendations,
  }
}

/** Bisezione per trovare IRR: NPV(r) = 0 su max 80 iterazioni. */
function bisectionIRR(
  cashflows: { date: string; amount: number }[],
): number | null {
  const t0 = Date.parse(cashflows[0].date)
  const tFracs = cashflows.map((c) => (Date.parse(c.date) - t0) / (365.25 * 86_400_000))

  function npv(r: number): number {
    let s = 0
    for (let i = 0; i < cashflows.length; i++) {
      s += cashflows[i].amount / Math.pow(1 + r, tFracs[i])
    }
    return s
  }

  let lo = -0.95, hi = 50
  const npvLo = npv(lo)
  const npvHi = npv(hi)
  if (Math.sign(npvLo) === Math.sign(npvHi)) return null

  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (Math.abs(hi - lo) < 1e-7) break
    if (Math.sign(npv(mid)) === Math.sign(npvLo)) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
