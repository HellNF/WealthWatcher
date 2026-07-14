// src/lib/calendar/index.ts — Scadenziario intelligente: orchestratore.
//
// Aggrega tutti i generatori di eventi, costruisce la proiezione di cassa e il
// layer di insight in un unico ScadenziarioBundle. Il contesto costoso (statistiche
// transazioni, zainetto fiscale, imposte patrimoniali per anno) è calcolato UNA
// sola volta e condiviso tra i generatori.
//
// Retro-compatibilità: `getFiscalCalendar` resta esportata con la stessa firma e
// restituisce le sole uscite cash (come prima), così i consumatori storici non
// cambiano comportamento.
import { sqlite } from '@/db'
import { transactionStats, spendingCycleByDay, cashflowForecastStats } from '@/lib/analytics'
import { computeFiscalWallet } from '@/lib/tax/wallet'
import { estimatedWealthTaxes } from '@/lib/tax/wealth'
import { generateHarvestingRecommendations } from '@/lib/tax/harvesting'
import { computeGoalsSummary } from '@/lib/goals'
import {
  wealthDeadlines, creditDeadlines, mortgageDeadlines, recurringDeadlines,
  dividendDeadlines, salaryDeadlines, goalDeadlines, consentDeadlines,
  harvestingDeadline, cryptoFranchiseDeadline, interestDeadlines, customEventDeadlines,
  yearsInRange, type GenCtx,
} from './generators'
import { buildCashProjection } from './projection'
import { computeScadenziarioInsights } from './insights'
import type { DeadlineEvent, ScadenziarioBundle } from './types'

export type {
  DeadlineEvent, DeadlineSource, DeadlineKind, FlowDirection, Confidence,
  EventSeverity, CashProjectionPoint, ScadenziarioSummary, ScadenziarioBundle,
} from './types'

const DAY_MS = 86_400_000
const WARNING_BUFFER_MINOR = 50_000  // €500, allineato a alerts/liquidity.ts

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

// ── Contesto condiviso ──────────────────────────────────────────────────────────

interface BuildContext {
  ctx:              GenCtx
  cashStartMinor:   number
  dailyBaselineMinor: number
  thresholdMinor:   number
  annualWealthTaxMinor: number
  recurring:        GenCtx['recurring']
  flowCtx:          ReturnType<typeof transactionStats>['ctx']
}

async function buildSharedContext(userId: number, from: string, to: string): Promise<BuildContext> {
  const today = new Date().toISOString().slice(0, 10)

  const stats  = transactionStats(userId)
  const wallet = computeFiscalWallet(userId)

  // Imposte patrimoniali per ogni anno coperto dall'intervallo
  const years = yearsInRange(from, to)
  const wealthList = await Promise.all(years.map(y => estimatedWealthTaxes(userId, y)))
  const wealthByYear = new Map(years.map((y, i) => [y, wealthList[i]]))

  const hasCrypto = !!sqlite.prepare(`
    SELECT 1 FROM investment_txns t JOIN instruments i ON i.id = t.instrument_id
    WHERE t.owner_id = ? AND i.cluster = 'crypto' LIMIT 1
  `).get(userId)

  const goalsSummary = await computeGoalsSummary(userId)
  const cashStartMinor = goalsSummary.freeOperatingCashMinor

  const annualWealthTaxMinor = wealthByYear.get(today.slice(0, 4))?.totalMinor ?? 0
  const forecast = cashflowForecastStats(stats.cashflow, stats.recurring, cashStartMinor, annualWealthTaxMinor)
  // Deriva ordinaria giornaliera dalla media netta storica (già comprensiva di
  // stipendio, spesa quotidiana e addebiti ricorrenti registrati nei movimenti).
  const dailyBaselineMinor = forecast.hasData ? Math.round(forecast.avgMonthlyNetMinor / 30) : 0
  const thresholdMinor = forecast.hasData ? forecast.thresholdMinor : 0

  const ctx: GenCtx = {
    userId, from, to, today,
    recurring: stats.recurring,
    incomes: stats.incomes,
    wallet, wealthByYear, hasCrypto,
  }

  return { ctx, cashStartMinor, dailyBaselineMinor, thresholdMinor, annualWealthTaxMinor, recurring: stats.recurring, flowCtx: stats.ctx }
}

// ── Aggregazione eventi ─────────────────────────────────────────────────────────

function runGenerators(ctx: GenCtx): DeadlineEvent[] {
  const events: DeadlineEvent[] = [
    ...wealthDeadlines(ctx),
    ...creditDeadlines(ctx),
    ...mortgageDeadlines(ctx),
    ...recurringDeadlines(ctx),
    ...dividendDeadlines(ctx),
    ...salaryDeadlines(ctx),
    ...goalDeadlines(ctx),
    ...consentDeadlines(ctx),
    ...harvestingDeadline(ctx),
    ...cryptoFranchiseDeadline(ctx),
    ...interestDeadlines(ctx),
    ...customEventDeadlines(ctx),
  ]
  events.sort((a, b) => a.date.localeCompare(b.date))
  return events
}

/**
 * Restituisce TUTTI gli eventi arricchiti nell'intervallo [from, to], ordinati per
 * data crescente. È la nuova API completa (cash + opportunità + info).
 */
export async function getScadenziarioEvents(
  userId: number, from: string, to: string,
): Promise<DeadlineEvent[]> {
  const { ctx } = await buildSharedContext(userId, from, to)
  return runGenerators(ctx)
}

/**
 * API legacy retro-compatibile: solo le uscite cash schedulate, come la vecchia
 * implementazione. Usata dai consumatori che sommano gli importi come uscite.
 */
export async function getFiscalCalendar(
  userId: number, from: string, to: string,
): Promise<DeadlineEvent[]> {
  const events = await getScadenziarioEvents(userId, from, to)
  return events.filter(e => e.kind === 'cash' && e.direction === 'out')
}

// ── Bundle completo per la pagina ────────────────────────────────────────────────

/**
 * Costruisce il pacchetto completo dello scadenziario: eventi, proiezione di cassa
 * su `horizonDays`, insight e riepilogo dell'orizzonte.
 */
export async function buildScadenziario(
  userId: number, from: string, to: string, horizonDays = 90,
): Promise<ScadenziarioBundle> {
  const shared = await buildSharedContext(userId, from, to)
  const { ctx, cashStartMinor, dailyBaselineMinor, annualWealthTaxMinor } = shared
  const today = ctx.today

  const events = runGenerators(ctx)

  // Proiezione di cassa sull'orizzonte
  const projection = buildCashProjection(events, cashStartMinor, today, horizonDays, dailyBaselineMinor)

  // Riepilogo: totali cash nell'orizzonte [oggi, oggi+horizon]
  const horizonEnd = addDays(today, horizonDays)
  let outflowMinor = 0, inflowMinor = 0
  for (const e of events) {
    if (e.kind !== 'cash' || e.date < today || e.date > horizonEnd) continue
    if (e.direction === 'out') outflowMinor += e.amountMinor
    else if (e.direction === 'in') inflowMinor += e.amountMinor
  }

  const status = projection.minBalanceMinor < 0
    ? 'CRITICAL_SHORTAGE'
    : projection.minBalanceMinor < WARNING_BUFFER_MINOR ? 'WARNING' : 'OK'

  const summary = {
    horizonDays,
    cashStartMinor,
    outflowMinor, inflowMinor,
    minBalanceMinor: projection.minBalanceMinor,
    minBalanceDate:  projection.minBalanceDate,
    thresholdMinor:  shared.thresholdMinor,
    status: status as ScadenziarioBundle['summary']['status'],
  }

  // Layer insight (harvesting async, invocato una sola volta)
  const harvesting = await generateHarvestingRecommendations(userId).catch(() => [])
  const insights = computeScadenziarioInsights({
    today, events,
    projection: projection.points,
    summary,
    recurring: shared.recurring,
    daySpending: spendingCycleByDay(shared.flowCtx),
    wealthTaxYearTotalMinor: annualWealthTaxMinor,
    harvesting,
  })

  return { events, insights, projection: projection.points, summary }
}

// ── Eventi personalizzati (CRUD) ─────────────────────────────────────────────────

export function createCustomEvent(
  userId: number, date: string, label: string, amountMinor: number, note?: string,
): void {
  sqlite.prepare(`
    INSERT INTO calendar_events (owner_id, date, label, amount_minor, note)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, date, label, amountMinor, note ?? null)
}

export function deleteCustomEvent(userId: number, eventId: number): void {
  sqlite.prepare(`
    DELETE FROM calendar_events WHERE id = ? AND owner_id = ?
  `).run(eventId, userId)
}
