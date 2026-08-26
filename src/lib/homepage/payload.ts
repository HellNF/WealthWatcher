// src/lib/homepage/payload.ts — Costruttori dei payload JSON per le route
// /api/homepage/v1/*, pensate per il widget customapi di Homepage
// (gethomepage.dev). Nessun calcolo nuovo: tutto riusa le funzioni esistenti
// di src/lib/*; qui si aggrega e si serializza al formato che Homepage sa
// mappare (denaro in unità maggiori, percentuali 0–100, date ISO).
//
// Convenzioni condivise da ogni endpoint (vedi docs/homepage-integration.md):
//  - denaro: float EUR a 2 decimali (mai minor units — Homepage formatta con Intl)
//  - percentuali: 0–100 con segno
//  - ogni risposta porta `stale` e `asOf`
import { listPortfolios } from '@/lib/portfolios'
import { getPortfolioPositions } from '@/lib/positions'
import { getPortfolioValuationEur } from '@/lib/portfolioValuation'
import { listAccounts, getAccountBalanceMinor } from '@/lib/accounts'
import { listInstitutions } from '@/lib/institutions'
import { convertToEur } from '@/lib/fx/convert'
import { ensureTodaySnapshot, listSnapshots, snapshotDelta } from '@/lib/valuation'
import { netWorthStats, portfolioMWRR, monthlyCashflow, runwayStats } from '@/lib/analytics'
import { buildFlowContext } from '@/lib/spending'
import { budgetStatus } from '@/lib/budgets'
import { cashRunwayAlert } from '@/lib/alerts/liquidity'
import { computeGoalsSummary, listGoals, isGoalCompleted } from '@/lib/goals'
import { getScadenziarioEvents } from '@/lib/calendar'
import { latentTaxStats } from '@/lib/tax/latent'
import { estimatedWealthTaxes } from '@/lib/tax/wealth'
import { getPortfolioAllocation, type Cluster } from '@/lib/marketOverview/allocation'

// ── Helper di serializzazione ─────────────────────────────────────────────────

/** Minor units EUR → float a 2 decimali (il formato che esce dagli endpoint). */
function eur(minor: number): number {
  return Math.round(minor) / 100
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const CLUSTER_LABEL: Record<Cluster, string> = {
  stock:  'Azioni',
  etf:    'ETF',
  bond:   'Obbligazioni',
  crypto: 'Crypto',
  other:  'Altro',
}

// ── Summary (display: block) ──────────────────────────────────────────────────

export interface HomepageChangePeriod {
  abs:     number
  pct:     number | null
  cagrPct: number | null
}

export interface HomepageSummary {
  currency:         'EUR'
  netWorth:         number
  invested:         number | null
  liquidity:        number
  otherAssets:      number
  costBasis:        number
  unrealizedPl:     number | null
  unrealizedPlPct:  number | null
  realizedPl:        number
  dividends:         number
  fees:              number
  change: {
    sinceLast: { abs: number; pct: number | null; days: number } | null
    '1m': HomepageChangePeriod | null
    '3m': HomepageChangePeriod | null
    '6m': HomepageChangePeriod | null
    '1y': HomepageChangePeriod | null
    all:  HomepageChangePeriod | null
  }
  risk: {
    maxDrawdownPct:  number | null
    volatilityPct:   number | null
    bestMonthPct:    number | null
    worstMonthPct:   number | null
  }
  tax: {
    latent:        number | null
    netInvestment: number | null
    wealthTaxYear: number | null
  }
  snapshotDate:     string | null
  snapshotAgeHours: number | null
  stale:            boolean
  asOf:             string
}

interface InvestmentTotals {
  costEur:       number
  marketEur:     number | null
  unrealizedEur: number | null
  realizedEur:   number
  dividendEur:   number
  feesEur:       number
  stale:         boolean
}

/**
 * Somma cost basis / valore di mercato / P&L su TUTTI i portafogli dell'utente,
 * convertiti in EUR. Estende getPortfolioValuationEur (che copre un singolo
 * portafoglio) con realized P/L, dividendi e commissioni — già calcolati per
 * valuta da getPortfolioPositions, qui solo aggregati e convertiti.
 */
async function investmentTotals(userId: number, date: string): Promise<InvestmentTotals> {
  let costEur       = 0
  let marketEur:     number | null = 0
  let unrealizedEur: number | null = 0
  let realizedEur    = 0
  let dividendEur     = 0
  let feesEur          = 0
  let stale           = false

  for (const portfolio of listPortfolios(userId)) {
    const { summary } = getPortfolioPositions(userId, portfolio.id)

    for (const c of summary.byCurrency) {
      const cost = await convertToEur(c.totalCostMinor, c.currency, date)
      if (cost !== null) costEur += cost
      else stale = true

      if (c.totalMarketMinor !== null && marketEur !== null) {
        const mv = await convertToEur(c.totalMarketMinor, c.currency, date)
        if (mv !== null) marketEur += mv
        else { marketEur = null; stale = true }
      } else {
        marketEur = null
        stale = true
      }

      if (c.totalUnrealizedPlMinor !== null && unrealizedEur !== null) {
        const pl = await convertToEur(c.totalUnrealizedPlMinor, c.currency, date)
        if (pl !== null) unrealizedEur += pl
        else { unrealizedEur = null; stale = true }
      } else {
        unrealizedEur = null
        stale = true
      }

      const realized = await convertToEur(c.totalRealizedPlMinor, c.currency, date)
      if (realized !== null) realizedEur += realized
      else stale = true

      const dividend = await convertToEur(c.totalDividendMinor, c.currency, date)
      if (dividend !== null) dividendEur += dividend
      else stale = true

      const fees = await convertToEur(c.totalFeesMinor, c.currency, date)
      if (fees !== null) feesEur += fees
      else stale = true
    }
  }

  return { costEur, marketEur, unrealizedEur, realizedEur, dividendEur, feesEur, stale }
}

const GROWTH_SLUGS = ['1m', '3m', '6m', '1y', 'all'] as const

export async function buildSummary(userId: number): Promise<HomepageSummary> {
  // Stesso calcolo della dashboard (ensureTodaySnapshot è già a costo quasi
  // nullo dopo la prima chiamata del giorno: fa solo un SELECT se lo snapshot
  // di oggi esiste già — vedi src/lib/valuation.ts).
  await ensureTodaySnapshot(userId).catch((e) => {
    console.error('[homepage] ensureTodaySnapshot fallito:', e)
  })

  const snapshots = listSnapshots(userId)
  const latest    = snapshots.at(-1) ?? null
  const delta     = snapshotDelta(snapshots)
  const date      = latest?.date ?? todayISO()

  const stats = netWorthStats(userId)
  const [inv, latentTax, wealthTax] = await Promise.all([
    investmentTotals(userId, date),
    latentTaxStats(userId).catch((e) => { console.error('[homepage] latentTaxStats fallito:', e); return null }),
    estimatedWealthTaxes(userId, String(new Date().getFullYear())).catch((e) => {
      console.error('[homepage] estimatedWealthTaxes fallito:', e)
      return null
    }),
  ])

  const change: HomepageSummary['change'] = {
    sinceLast: delta ? { abs: eur(delta.absMinor), pct: delta.pct, days: delta.days } : null,
    '1m': null, '3m': null, '6m': null, '1y': null, all: null,
  }
  stats.growth.forEach((g, i) => {
    const slug = GROWTH_SLUGS[i]
    if (!slug) return
    change[slug] = g.changeMinor !== null
      ? { abs: eur(g.changeMinor), pct: g.changePct, cagrPct: g.cagrPct }
      : null
  })

  const snapshotAgeHours = latest
    ? Math.round((Date.parse(todayISO()) - Date.parse(latest.date)) / 3_600_000)
    : null

  return {
    currency:        'EUR',
    netWorth:        eur(latest?.net_worth_eur_minor ?? 0),
    invested:        inv.marketEur !== null ? eur(inv.marketEur) : null,
    liquidity:       eur(latest?.accounts_eur_minor ?? 0),
    otherAssets:     eur(latest?.other_assets_eur_minor ?? 0),
    costBasis:       eur(inv.costEur),
    unrealizedPl:    inv.unrealizedEur !== null ? eur(inv.unrealizedEur) : null,
    unrealizedPlPct: inv.unrealizedEur !== null && inv.costEur > 0
      ? round2((inv.unrealizedEur / inv.costEur) * 100)
      : null,
    realizedPl: eur(inv.realizedEur),
    dividends:  eur(inv.dividendEur),
    fees:       eur(inv.feesEur),
    change,
    risk: {
      maxDrawdownPct: stats.volatility.maxDrawdownPct,
      volatilityPct:  stats.volatility.stdDevMonthlyPct,
      bestMonthPct:   stats.volatility.bestMonthPct,
      worstMonthPct:  stats.volatility.worstMonthPct,
    },
    tax: {
      latent:        latentTax ? eur(latentTax.latentTaxMinor)    : null,
      netInvestment: latentTax ? eur(latentTax.netInvestmentMinor) : null,
      wealthTaxYear: wealthTax ? eur(wealthTax.totalMinor)         : null,
    },
    snapshotDate: latest?.date ?? null,
    snapshotAgeHours,
    stale: (latest?.stale === 1) || inv.stale || stats.hasStaleSnapshots,
    asOf: new Date().toISOString(),
  }
}

// ── Portafogli (display: dynamic-list) ────────────────────────────────────────

export interface HomepagePortfolioItem {
  name:     string
  value:    number | null
  label:    string
  plPct:    number | null
  mwrrPct:  number | null
  currency: string
  stale:    boolean
}

export interface HomepagePortfolios {
  items:    HomepagePortfolioItem[]
  total:    number
  currency: 'EUR'
  stale:    boolean
  asOf:     string
}

export async function buildPortfolios(userId: number): Promise<HomepagePortfolios> {
  const date       = todayISO()
  const portfolios = listPortfolios(userId)
  const mwrrByPortfolio = new Map(portfolioMWRR(userId).map((r) => [r.portfolioId, r.mwrrPct]))

  let total = 0
  let stale = false

  const items = await Promise.all(portfolios.map(async (p): Promise<HomepagePortfolioItem> => {
    const valuation = await getPortfolioValuationEur(userId, p.id, date)
    if (valuation.marketValueEurMinor === null) stale = true
    else total += valuation.marketValueEurMinor

    const value = valuation.marketValueEurMinor !== null ? eur(valuation.marketValueEurMinor) : null
    return {
      name:     p.name,
      value,
      label:    value !== null ? formatEurLabel(value) : 'n/d',
      plPct:    valuation.plPct,
      mwrrPct:  mwrrByPortfolio.get(p.id) ?? null,
      currency: p.currency,
      stale:    valuation.marketValueEurMinor === null,
    }
  }))

  return { items, total: eur(total), currency: 'EUR', stale, asOf: new Date().toISOString() }
}

// ── Conti (display: dynamic-list) ─────────────────────────────────────────────

export interface HomepageAccountItem {
  name:        string
  institution: string
  value:       number | null
  label:       string
  currency:    string
}

export interface HomepageAccounts {
  items:    HomepageAccountItem[]
  total:    number
  currency: 'EUR'
  stale:    boolean
  asOf:     string
}

export async function buildAccounts(userId: number): Promise<HomepageAccounts> {
  const date = todayISO()
  const institutionMap = new Map(listInstitutions(userId).map((i) => [i.id, i.name]))

  let total = 0
  let stale = false

  const items = await Promise.all(listAccounts(userId).map(async (a): Promise<HomepageAccountItem> => {
    const balanceMinor = getAccountBalanceMinor(a.id)
    const eurMinor = await convertToEur(balanceMinor, a.currency, date)
    if (eurMinor === null) stale = true
    else total += eurMinor

    const value = eurMinor !== null ? eur(eurMinor) : null
    return {
      name:        a.name,
      institution: institutionMap.get(a.institution_id) ?? '',
      value,
      label:       value !== null ? formatEurLabel(value) : 'n/d',
      currency:    a.currency,
    }
  }))

  return { items, total: eur(total), currency: 'EUR', stale, asOf: new Date().toISOString() }
}

// ── Cashflow / risparmio (display: block) ─────────────────────────────────────

export interface HomepageCashflow {
  month:          string
  income:         number
  expenses:       number
  savings:        number
  savingsRatePct: number | null
  avg3m: {
    income:   number
    expenses: number
    savings:  number
  } | null
  budget: {
    limit:     number | null
    spent:     number
    usedPct:   number | null
    remaining: number | null
  }
  runway: {
    months: number | null
    status: 'OK' | 'WARNING' | 'CRITICAL_SHORTAGE'
  }
  currency: 'EUR'
  asOf:     string
}

export async function buildCashflow(userId: number): Promise<HomepageCashflow> {
  const currentMonth = todayISO().slice(0, 7)
  const ctx  = buildFlowContext(userId)
  const rows = monthlyCashflow(ctx)

  const current = rows.find((r) => r.month === currentMonth) ?? null
  const last3    = rows.slice(-3)
  const avg3m    = last3.length > 0
    ? {
        income:   eur(Math.round(last3.reduce((s, r) => s + r.inflow, 0) / last3.length)),
        expenses: eur(Math.round(last3.reduce((s, r) => s + r.outflow, 0) / last3.length)),
        savings:  eur(Math.round(last3.reduce((s, r) => s + r.net, 0) / last3.length)),
      }
    : null

  const budget  = budgetStatus(userId, currentMonth)
  const goals   = await computeGoalsSummary(userId)
  const runway  = runwayStats(ctx, goals.totalCashMinor)
  const alert   = await cashRunwayAlert(userId).catch((e) => {
    console.error('[homepage] cashRunwayAlert fallito:', e)
    return null
  })
  const normalScenario = runway.scenarios.find((s) => s.label === 'Spesa normale') ?? null

  return {
    month:          currentMonth,
    income:         eur(current?.inflow ?? 0),
    expenses:       eur(current?.outflow ?? 0),
    savings:        eur(current?.net ?? 0),
    savingsRatePct: current?.savingsRate ?? null,
    avg3m,
    budget: {
      limit:     budget.total.limit_minor !== null ? eur(budget.total.limit_minor) : null,
      spent:     eur(budget.total.spent_minor),
      usedPct:   budget.total.pct,
      remaining: budget.total.limit_minor !== null
        ? eur(budget.total.limit_minor - budget.total.spent_minor)
        : null,
    },
    runway: {
      months: normalScenario ? normalScenario.months : null,
      status: alert?.status ?? 'OK',
    },
    currency: 'EUR',
    asOf: new Date().toISOString(),
  }
}

// ── Obiettivi (display: dynamic-list) ─────────────────────────────────────────

export interface HomepageGoalItem {
  name:         string
  allocated:    number
  target:       number
  progressPct:  number
  label:        string
  targetDate:   string | null
  completed:    boolean
}

export interface HomepageGoals {
  items:    HomepageGoalItem[]
  freeCash: number
  currency: 'EUR'
  asOf:     string
}

export async function buildGoals(userId: number): Promise<HomepageGoals> {
  const goals   = listGoals(userId)
  const summary = await computeGoalsSummary(userId)

  const items = goals.map((g): HomepageGoalItem => {
    const progressPct = g.target_amount_minor > 0
      ? round2(Math.min(100, (g.current_allocated_minor / g.target_amount_minor) * 100))
      : 0
    return {
      name:        g.name,
      allocated:   eur(g.current_allocated_minor),
      target:      eur(g.target_amount_minor),
      progressPct,
      label:       `${formatEurLabel(eur(g.current_allocated_minor))} / ${formatEurLabel(eur(g.target_amount_minor))}`,
      targetDate:  g.target_date,
      completed:   isGoalCompleted(g),
    }
  })

  return { items, freeCash: eur(summary.freeOperatingCashMinor), currency: 'EUR', asOf: new Date().toISOString() }
}

// ── Scadenze (display: dynamic-list) ──────────────────────────────────────────

export interface HomepageDeadlineItem {
  date:       string
  name:       string
  amount:     number
  label:      string
  direction:  'in' | 'out' | 'none'
  severity:   string | null
  confidence: string
}

export interface HomepageDeadlines {
  items:     HomepageDeadlineItem[]
  count:     number
  totalOut:  number
  totalIn:   number
  currency:  'EUR'
  asOf:      string
}

export async function buildDeadlines(userId: number, days: number): Promise<HomepageDeadlines> {
  const from = todayISO()
  const toDate = new Date()
  toDate.setDate(toDate.getDate() + days)
  const to = toDate.toISOString().slice(0, 10)

  const events = await getScadenziarioEvents(userId, from, to)

  let totalOut = 0
  let totalIn  = 0
  const items = events.map((e): HomepageDeadlineItem => {
    if (e.direction === 'out') totalOut += e.amountMinor
    else totalIn += e.amountMinor
    return {
      date:       e.date,
      name:       e.label,
      amount:     eur(e.amountMinor),
      label:      `${e.direction === 'out' ? '-' : '+'}${formatEurLabel(eur(e.amountMinor))}`,
      direction:  e.direction,
      severity:   e.severity ?? null,
      confidence: e.confidence,
    }
  })

  return {
    items,
    count:    items.length,
    totalOut: eur(totalOut),
    totalIn:  eur(totalIn),
    currency: 'EUR',
    asOf:     new Date().toISOString(),
  }
}

// ── Allocazione per classe di asset (display: dynamic-list) ──────────────────

export interface HomepageAllocationItem {
  name:  string
  value: number
  pct:   number
  label: string
}

export interface HomepageAllocation {
  items:    HomepageAllocationItem[]
  total:    number
  currency: 'EUR'
  stale:    boolean
  asOf:     string
}

export async function buildAllocation(userId: number): Promise<HomepageAllocation> {
  const result = await getPortfolioAllocation(userId, todayISO())
  const items = result.byCluster.map((c): HomepageAllocationItem => ({
    name:  CLUSTER_LABEL[c.cluster],
    value: eur(c.valueEurMinor),
    pct:   round2(c.pct),
    label: `${round2(c.pct).toLocaleString('it-IT')}%`,
  }))
  return {
    items,
    total: eur(result.totalEurMinor),
    currency: 'EUR',
    stale: result.hasStalePrices,
    asOf: new Date().toISOString(),
  }
}

// ── Formattazione condivisa per i campi `label` (dynamic-list) ───────────────

function formatEurLabel(value: number): string {
  return value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}
