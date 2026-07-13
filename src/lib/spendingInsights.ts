// src/lib/spendingInsights.ts — Metriche contabili avanzate sulle transazioni.
// Tutte le funzioni sono pure: operano su array FlowTxn / MonthlyCashflow già
// calcolati (trasferimenti esclusi a monte) e degradano a hasData:false sotto
// le soglie minime di dati — mai numeri deboli spacciati per insight.
import { flowTxnKey, gapsInDays, mad, median, type FlowTxn } from '@/lib/spending'
import type { MonthlyCashflow, RecurringItem } from '@/lib/analytics'

// ── Helpers comuni ────────────────────────────────────────────────────────────

function monthKey(iso: string): string { return iso.slice(0, 7) }

function currentMonthKey(today: Date): string {
  return today.toISOString().slice(0, 7)
}

/** Mesi 'YYYY-MM' precedenti a `beforeMonth`, dal più recente, max `count`. */
function previousMonths(beforeMonth: string, count: number): string[] {
  const [y, m] = beforeMonth.split('-').map(Number)
  const out: string[] = []
  let year = y, month = m
  for (let i = 0; i < count; i++) {
    month -= 1
    if (month === 0) { month = 12; year -= 1 }
    out.push(`${year}-${String(month).padStart(2, '0')}`)
  }
  return out
}

// ═══════════════════════════════════════════════════════════════════════════════
// MONTH BRIDGE — variance analysis: mese focus vs mese tipico
// ═══════════════════════════════════════════════════════════════════════════════

export interface BridgeItem {
  categoryId:   number | null
  categoryName: string
  actualMinor:  number   // spesa nel mese focus (positivo)
  typicalMinor: number   // mediana dei 6 mesi completi precedenti
  deltaMinor:   number   // actual − typical (positivo = speso di più)
}

export interface MonthBridge {
  hasData:          boolean
  month:            string   // mese focus YYYY-MM
  isPartialMonth:   boolean  // true se il focus è il mese corrente (ancora in corso)
  totalActualMinor: number
  totalTypicalMinor: number
  totalDeltaMinor:  number
  items:            BridgeItem[]  // solo delta materiali, ordinati per |delta| desc
  otherDeltaMinor:  number        // somma dei delta sotto soglia
  monthsInBaseline: number
}

const BRIDGE_MIN_DELTA_MINOR = 2000  // €20
const BRIDGE_MIN_DELTA_PCT   = 0.15

/**
 * Confronta la spesa per categoria del mese focus con il "mese tipico"
 * (mediana per categoria sui 6 mesi completi precedenti, zeri inclusi).
 * Focus di default: mese corrente se siamo a fine mese (giorno ≥ 25),
 * altrimenti l'ultimo mese completo. `focusMonth` (YYYY-MM) lo sovrascrive.
 */
export function monthBridge(
  expenses: FlowTxn[],
  today = new Date(),
  focusMonth?: string,
): MonthBridge {
  const empty: MonthBridge = {
    hasData: false, month: '', isPartialMonth: false,
    totalActualMinor: 0, totalTypicalMinor: 0, totalDeltaMinor: 0,
    items: [], otherDeltaMinor: 0, monthsInBaseline: 0,
  }

  const current = currentMonthKey(today)
  const focus   = focusMonth
    ?? (today.getUTCDate() >= 25 ? current : previousMonths(current, 1)[0])
  const isPartialMonth = focus === current

  const baselineMonths = previousMonths(focus, 6)

  // Spesa per (mese, categoria)
  const byMonthCat = new Map<string, Map<string, number>>()
  const catNames   = new Map<string, { id: number | null; name: string }>()
  for (const t of expenses) {
    const m = monthKey(t.booked_date)
    if (m !== focus && !baselineMonths.includes(m)) continue
    const catKey = String(t.category_id ?? 'none')
    if (!catNames.has(catKey)) {
      catNames.set(catKey, { id: t.category_id, name: t.category_name ?? 'Senza categoria' })
    }
    let mm = byMonthCat.get(m)
    if (!mm) { mm = new Map(); byMonthCat.set(m, mm) }
    mm.set(catKey, (mm.get(catKey) ?? 0) + Math.abs(t.amount_minor))
  }

  const monthsWithData = baselineMonths.filter((m) => byMonthCat.has(m))
  if (monthsWithData.length < 3) return { ...empty, month: focus, isPartialMonth }

  const focusMap = byMonthCat.get(focus) ?? new Map<string, number>()

  const items: BridgeItem[] = []
  let otherDelta = 0
  let totalActual = 0
  let totalTypical = 0

  for (const [catKey, { id, name }] of catNames) {
    // Mediana sui mesi con dati, con 0 per i mesi in cui la categoria non appare
    const series  = monthsWithData.map((m) => byMonthCat.get(m)!.get(catKey) ?? 0)
    const typical = Math.round(median(series))
    const actual  = focusMap.get(catKey) ?? 0
    const delta   = actual - typical
    totalActual  += actual
    totalTypical += typical

    const material = Math.abs(delta) >= BRIDGE_MIN_DELTA_MINOR
      && (typical === 0 || Math.abs(delta) >= typical * BRIDGE_MIN_DELTA_PCT)
    if (material) {
      items.push({ categoryId: id, categoryName: name, actualMinor: actual, typicalMinor: typical, deltaMinor: delta })
    } else {
      otherDelta += delta
    }
  }

  items.sort((a, b) => Math.abs(b.deltaMinor) - Math.abs(a.deltaMinor))

  return {
    hasData: true,
    month: focus,
    isPartialMonth,
    totalActualMinor:  totalActual,
    totalTypicalMinor: totalTypical,
    totalDeltaMinor:   totalActual - totalTypical,
    items,
    otherDeltaMinor:   otherDelta,
    monthsInBaseline:  monthsWithData.length,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FISSI vs VARIABILI — break-even mensile e committed ratio
// ═══════════════════════════════════════════════════════════════════════════════

export interface FixedVariableMonth {
  month:         string
  fixedMinor:    number
  variableMinor: number
}

export interface FixedVariableSplit {
  hasData:            boolean
  fixedMonthlyMinor:    number   // break-even: spese incomprimibili tipiche/mese
  variableMonthlyMinor: number
  committedRatioPct:  number | null  // fissi / reddito mediano
  medianIncomeMinor:  number | null
  series:             FixedVariableMonth[]  // ultimi mesi completi, per il chart
}

/** Categorie considerate strutturalmente vincolate (nomi dal seed). */
export const COMMITTED_CATEGORIES = new Set(['Mutuo', 'Utenze', 'Abbonamenti', 'Tasse', 'Previdenza'])

/**
 * Divide la spesa in fissa (ricorrenti attivi subscription/bill + categorie
 * vincolate) e variabile. Il break-even è la mediana mensile della parte fissa.
 */
export function fixedVariableSplit(
  expenses:  FlowTxn[],
  recurring: RecurringItem[],
  cashflow:  MonthlyCashflow[],
  today = new Date(),
): FixedVariableSplit {
  const empty: FixedVariableSplit = {
    hasData: false, fixedMonthlyMinor: 0, variableMonthlyMinor: 0,
    committedRatioPct: null, medianIncomeMinor: null, series: [],
  }

  const current = currentMonthKey(today)
  const window  = previousMonths(current, 12)  // fino a 12 mesi completi

  const fixedKeys = new Set(
    recurring
      .filter((r) => r.kind !== 'habit' && r.status === 'active')
      .map((r) => r.key),
  )

  const perMonth = new Map<string, { fixed: number; variable: number }>()
  for (const t of expenses) {
    const m = monthKey(t.booked_date)
    if (!window.includes(m)) continue
    let entry = perMonth.get(m)
    if (!entry) { entry = { fixed: 0, variable: 0 }; perMonth.set(m, entry) }
    const key = flowTxnKey(t)
    const isFixed = (key !== null && fixedKeys.has(key))
      || (t.category_name !== null && COMMITTED_CATEGORIES.has(t.category_name))
    if (isFixed) entry.fixed += Math.abs(t.amount_minor)
    else entry.variable += Math.abs(t.amount_minor)
  }

  const months = window.filter((m) => perMonth.has(m))
  if (months.length < 3) return empty

  // Serie in ordine cronologico
  const series: FixedVariableMonth[] = [...months].reverse().map((m) => ({
    month:         m,
    fixedMinor:    perMonth.get(m)!.fixed,
    variableMinor: perMonth.get(m)!.variable,
  }))

  const recent = months.slice(0, 6)  // ultimi 6 mesi completi con dati
  const fixedMonthly    = Math.round(median(recent.map((m) => perMonth.get(m)!.fixed)))
  const variableMonthly = Math.round(median(recent.map((m) => perMonth.get(m)!.variable)))

  const incomes = cashflow
    .filter((c) => recent.includes(c.month) && c.inflow > 0)
    .map((c) => c.inflow)
  const medianIncome = incomes.length >= 3 ? Math.round(median(incomes)) : null
  // Il rapporto ha senso solo con un reddito tracciato plausibile (≥ €500/mese):
  // se lo stipendio arriva su un conto non collegato, meglio tacere che sparare 800%.
  const committedRatioPct = medianIncome !== null && medianIncome >= 50000
    ? Math.round((fixedMonthly / medianIncome) * 1000) / 10
    : null

  return {
    hasData: true,
    fixedMonthlyMinor:    fixedMonthly,
    variableMonthlyMinor: variableMonthly,
    committedRatioPct,
    medianIncomeMinor:    medianIncome,
    series,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INFLAZIONE PERSONALE — trend dello scontrino mediano per merchant
// ═══════════════════════════════════════════════════════════════════════════════

export interface InflationItem {
  label:            string
  oldMedianMinor:   number  // scontrino mediano, mesi −12…−7
  recentMedianMinor: number // scontrino mediano, ultimi 6 mesi
  deltaPct:         number
  recentSpendMinor: number
}

export interface PersonalInflation {
  hasData:    boolean
  overallPct: number | null  // media dei delta pesata per spesa recente
  items:      InflationItem[]
}

const INFLATION_MIN_TXNS  = 5
const INFLATION_MIN_SPEND = 5000  // €50 per finestra
const INFLATION_MIN_DELTA = 3     // ±3% per finire tra i mover

/**
 * Per ogni merchant confronta lo scontrino mediano degli ultimi 6 mesi con
 * quello dei mesi −12…−7: la tua inflazione, non quella ISTAT.
 */
export function personalInflation(expenses: FlowTxn[], today = new Date()): PersonalInflation {
  const empty: PersonalInflation = { hasData: false, overallPct: null, items: [] }
  if (expenses.length === 0) return empty

  // Servono ≥ 13 mesi di storia
  const oldest = expenses[0].booked_date
  const thirteenMonthsAgo = new Date(today)
  thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13)
  if (oldest > thirteenMonthsAgo.toISOString().slice(0, 10)) return empty

  const sixAgo    = new Date(today); sixAgo.setMonth(sixAgo.getMonth() - 6)
  const twelveAgo = new Date(today); twelveAgo.setMonth(twelveAgo.getMonth() - 12)
  const recentFrom = sixAgo.toISOString().slice(0, 10)
  const oldFrom    = twelveAgo.toISOString().slice(0, 10)

  interface Bucket { label: string; old: number[]; recent: number[] }
  const buckets = new Map<string, Bucket>()
  for (const t of expenses) {
    if (t.booked_date < oldFrom) continue
    const key = flowTxnKey(t)
    if (!key) continue
    let b = buckets.get(key)
    if (!b) {
      b = { label: t.merchant_name ?? t.description_raw.slice(0, 40), old: [], recent: [] }
      buckets.set(key, b)
    }
    const abs = Math.abs(t.amount_minor)
    if (t.booked_date >= recentFrom) b.recent.push(abs)
    else b.old.push(abs)
  }

  const items: InflationItem[] = []
  let weightedSum = 0
  let weightTotal = 0
  for (const b of buckets.values()) {
    const oldSpend    = b.old.reduce((s, a) => s + a, 0)
    const recentSpend = b.recent.reduce((s, a) => s + a, 0)
    if (b.old.length < INFLATION_MIN_TXNS || b.recent.length < INFLATION_MIN_TXNS) continue
    if (oldSpend < INFLATION_MIN_SPEND || recentSpend < INFLATION_MIN_SPEND) continue

    const oldMed    = median(b.old)
    const recentMed = median(b.recent)
    if (oldMed <= 0) continue
    const deltaPct = Math.round(((recentMed / oldMed) - 1) * 1000) / 10

    weightedSum += deltaPct * recentSpend
    weightTotal += recentSpend

    if (Math.abs(deltaPct) >= INFLATION_MIN_DELTA) {
      items.push({
        label: b.label,
        oldMedianMinor:    Math.round(oldMed),
        recentMedianMinor: Math.round(recentMed),
        deltaPct,
        recentSpendMinor:  recentSpend,
      })
    }
  }

  if (weightTotal === 0) return empty

  items.sort((a, b) => b.deltaPct - a.deltaPct)
  return {
    hasData: true,
    overallPct: Math.round((weightedSum / weightTotal) * 10) / 10,
    items: items.slice(0, 8),
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILO REDDITO — regolarità stipendio e concentrazione fonti
// ═══════════════════════════════════════════════════════════════════════════════

export interface IncomeProfile {
  hasData:            boolean
  salaryLabel:        string | null
  salaryMedianMinor:  number | null
  payDayMedian:       number | null   // giorno del mese mediano di accredito
  payDayJitterDays:   number | null   // MAD dei giorni: 0 = orologio svizzero
  topSourceSharePct:  number | null   // quota della fonte principale sul reddito 12 mesi
  sourceCount:        number          // fonti distinte con almeno €100/anno
}

/**
 * Individua lo "stipendio" (accredito con cadenza ~mensile, importo stabile,
 * totale maggiore) e misura regolarità e concentrazione delle fonti di reddito.
 */
export function incomeProfile(incomes: FlowTxn[], today = new Date()): IncomeProfile {
  const empty: IncomeProfile = {
    hasData: false, salaryLabel: null, salaryMedianMinor: null,
    payDayMedian: null, payDayJitterDays: null, topSourceSharePct: null, sourceCount: 0,
  }

  const twelveAgo = new Date(today)
  twelveAgo.setMonth(twelveAgo.getMonth() - 12)
  const from = twelveAgo.toISOString().slice(0, 10)
  const recent = incomes.filter((t) => t.booked_date >= from)
  if (recent.length === 0) return empty

  interface Bucket { label: string; txns: FlowTxn[]; total: number }
  const buckets = new Map<string, Bucket>()
  for (const t of recent) {
    const key = flowTxnKey(t) ?? `raw:${t.description_raw.toLowerCase().slice(0, 24)}`
    let b = buckets.get(key)
    if (!b) {
      b = { label: t.merchant_name ?? t.description_raw.slice(0, 40), txns: [], total: 0 }
      buckets.set(key, b)
    }
    b.txns.push(t)
    b.total += Math.abs(t.amount_minor)
  }

  const totalIncome = recent.reduce((s, t) => s + Math.abs(t.amount_minor), 0)
  const sourceCount = [...buckets.values()].filter((b) => b.total >= 10000).length
  const sorted = [...buckets.values()].sort((a, b) => b.total - a.total)
  const topSourceSharePct = totalIncome > 0 && sorted.length > 0
    ? Math.round((sorted[0].total / totalIncome) * 1000) / 10
    : null

  // Stipendio: cadenza ~mensile, importo stabile (relMAD ≤ 0.15), ≥ 4 accrediti
  let salary: Bucket | null = null
  for (const b of sorted) {
    if (b.txns.length < 4) continue
    const gaps = gapsInDays(b.txns.map((t) => t.booked_date))
    const medGap = median(gaps)
    if (medGap < 27 || medGap > 34) continue
    const amounts = b.txns.map((t) => Math.abs(t.amount_minor))
    const medAmt = median(amounts)
    if (medAmt <= 0 || mad(amounts) / medAmt > 0.15) continue
    salary = b
    break
  }

  if (!salary) {
    return { ...empty, hasData: sourceCount > 0, topSourceSharePct, sourceCount }
  }

  const days = salary.txns.map((t) => Number(t.booked_date.slice(8, 10)))
  return {
    hasData: true,
    salaryLabel:       salary.label,
    salaryMedianMinor: Math.round(median(salary.txns.map((t) => Math.abs(t.amount_minor)))),
    payDayMedian:      Math.round(median(days)),
    payDayJitterDays:  Math.round(mad(days) * 10) / 10,
    topSourceSharePct,
    sourceCount,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PACING INTRA-MESE — cumulata corrente vs mese tipico + proiezione
// ═══════════════════════════════════════════════════════════════════════════════

export interface PacingPoint {
  day:            number
  typicalMinor:   number
  actualMinor:    number | null   // null oltre oggi
  projectedMinor: number | null   // solo da oggi in poi
}

export interface MonthPacing {
  hasData:            boolean
  month:              string
  today:              number   // giorno del mese
  actualToDateMinor:  number
  typicalToDateMinor: number
  typicalEndMinor:    number
  projectedEndMinor:  number
  deviationPct:       number | null  // (actual − typical) / typical a oggi
  points:             PacingPoint[]
  monthsInBaseline:   number
}

/**
 * Curva di spesa cumulata del mese corrente contro il mese "tipico"
 * (mediana per giorno sui 6 mesi completi precedenti) con proiezione a fine mese.
 */
export function monthPacing(expenses: FlowTxn[], today = new Date()): MonthPacing {
  const current  = currentMonthKey(today)
  const todayDay = today.getUTCDate()
  const empty: MonthPacing = {
    hasData: false, month: current, today: todayDay,
    actualToDateMinor: 0, typicalToDateMinor: 0, typicalEndMinor: 0,
    projectedEndMinor: 0, deviationPct: null, points: [], monthsInBaseline: 0,
  }
  if (todayDay < 5) return empty

  const baselineMonths = previousMonths(current, 6)

  // Spesa giornaliera per mese
  const dailyByMonth = new Map<string, number[]>()  // month → array[32] di spesa per giorno
  for (const t of expenses) {
    const m = monthKey(t.booked_date)
    if (m !== current && !baselineMonths.includes(m)) continue
    let arr = dailyByMonth.get(m)
    if (!arr) { arr = new Array(32).fill(0); dailyByMonth.set(m, arr) }
    arr[Number(t.booked_date.slice(8, 10))] += Math.abs(t.amount_minor)
  }

  const monthsWithData = baselineMonths.filter((m) => dailyByMonth.has(m))
  if (monthsWithData.length < 3) return empty

  // Cumulate baseline per giorno 1..31
  const cumByMonth = monthsWithData.map((m) => {
    const daily = dailyByMonth.get(m)!
    const cum: number[] = new Array(32).fill(0)
    for (let d = 1; d <= 31; d++) cum[d] = cum[d - 1] + daily[d]
    return cum
  })
  const typical = (d: number) => Math.round(median(cumByMonth.map((c) => c[Math.min(d, 31)])))

  // Cumulata del mese corrente
  const currentDaily = dailyByMonth.get(current) ?? new Array(32).fill(0)
  const actualCum: number[] = new Array(32).fill(0)
  for (let d = 1; d <= 31; d++) actualCum[d] = actualCum[d - 1] + currentDaily[d]

  const daysInMonth = new Date(Date.UTC(
    Number(current.slice(0, 4)), Number(current.slice(5, 7)), 0,
  )).getUTCDate()

  const actualToDate  = actualCum[Math.min(todayDay, daysInMonth)]
  const typicalToDate = typical(todayDay)
  const typicalEnd    = typical(daysInMonth)
  const projectedEnd  = Math.max(actualToDate, actualToDate + (typicalEnd - typicalToDate))

  const points: PacingPoint[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    const isPast = d <= todayDay
    // Proiezione lineare dal punto attuale verso projectedEnd
    const projected = !isPast
      ? Math.round(actualToDate + (projectedEnd - actualToDate) * ((d - todayDay) / Math.max(1, daysInMonth - todayDay)))
      : d === todayDay ? actualToDate : null
    points.push({
      day: d,
      typicalMinor:   typical(d),
      actualMinor:    isPast ? actualCum[d] : null,
      projectedMinor: projected,
    })
  }

  return {
    hasData: true,
    month: current,
    today: todayDay,
    actualToDateMinor:  actualToDate,
    typicalToDateMinor: typicalToDate,
    typicalEndMinor:    typicalEnd,
    projectedEndMinor:  projectedEnd,
    deviationPct: typicalToDate > 0
      ? Math.round(((actualToDate - typicalToDate) / typicalToDate) * 1000) / 10
      : null,
    points,
    monthsInBaseline: monthsWithData.length,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONCENTRAZIONE MERCHANT & CONFRONTO YoY
// ═══════════════════════════════════════════════════════════════════════════════

export interface MerchantConcentration {
  hasData:      boolean
  top5SharePct: number | null
  topLabels:    string[]
}

/** Quota della spesa degli ultimi 12 mesi concentrata nei primi 5 esercenti. */
export function merchantConcentration(expenses: FlowTxn[], today = new Date()): MerchantConcentration {
  const twelveAgo = new Date(today)
  twelveAgo.setMonth(twelveAgo.getMonth() - 12)
  const from = twelveAgo.toISOString().slice(0, 10)

  const totals = new Map<string, { label: string; total: number }>()
  let grand = 0
  for (const t of expenses) {
    if (t.booked_date < from) continue
    const abs = Math.abs(t.amount_minor)
    grand += abs
    const key = flowTxnKey(t)
    if (!key) continue
    let e = totals.get(key)
    if (!e) { e = { label: t.merchant_name ?? t.description_raw.slice(0, 40), total: 0 }; totals.set(key, e) }
    e.total += abs
  }

  if (grand === 0 || totals.size < 5) return { hasData: false, top5SharePct: null, topLabels: [] }

  const top = [...totals.values()].sort((a, b) => b.total - a.total).slice(0, 5)
  return {
    hasData: true,
    top5SharePct: Math.round((top.reduce((s, e) => s + e.total, 0) / grand) * 1000) / 10,
    topLabels: top.map((e) => e.label),
  }
}

export interface MiscategorizedFlows {
  hasData:              boolean
  /** Uscite con categoria di tipo 'income' (es. bonifici in uscita marcati Entrate). */
  expenseCount:         number
  expenseTotalMinor:    number
  /** Entrate con categoria di tipo 'expense'. */
  incomeCount:          number
  incomeTotalMinor:     number
}

/**
 * Qualità dei dati: movimenti il cui segno contraddice il tipo della categoria.
 * Un'uscita categorizzata "Entrate" è quasi sempre una miscategorizzazione
 * (spesso un trasferimento verso un conto proprio non collegato) e inquina
 * bridge, outlier e tassi di risparmio.
 */
export function miscategorizedFlows(expenses: FlowTxn[], incomes: FlowTxn[]): MiscategorizedFlows {
  let expenseCount = 0, expenseTotal = 0
  for (const t of expenses) {
    if (t.category_kind === 'income') { expenseCount++; expenseTotal += Math.abs(t.amount_minor) }
  }
  let incomeCount = 0, incomeTotal = 0
  for (const t of incomes) {
    if (t.category_kind === 'expense') { incomeCount++; incomeTotal += Math.abs(t.amount_minor) }
  }
  const material = (expenseCount >= 3 && expenseTotal >= 10000) || (incomeCount >= 3 && incomeTotal >= 10000)
  return {
    hasData: material,
    expenseCount,
    expenseTotalMinor: expenseTotal,
    incomeCount,
    incomeTotalMinor: incomeTotal,
  }
}

export interface SameMonthYoY {
  hasData:        boolean
  month:          string   // mese focus (ultimo completo) YYYY-MM
  currentMinor:   number
  lastYearMinor:  number
  deltaPct:       number | null
}

/** Confronto stagionale: ultimo mese completo vs stesso mese dell'anno scorso. */
export function sameMonthYoY(expenses: FlowTxn[], today = new Date()): SameMonthYoY {
  const focus = previousMonths(currentMonthKey(today), 1)[0]
  const lastYear = `${Number(focus.slice(0, 4)) - 1}${focus.slice(4)}`

  let cur = 0, old = 0, hasOld = false
  for (const t of expenses) {
    const m = monthKey(t.booked_date)
    if (m === focus) cur += Math.abs(t.amount_minor)
    else if (m === lastYear) { old += Math.abs(t.amount_minor); hasOld = true }
  }

  if (!hasOld || cur === 0) {
    return { hasData: false, month: focus, currentMinor: cur, lastYearMinor: old, deltaPct: null }
  }
  return {
    hasData: true,
    month: focus,
    currentMinor: cur,
    lastYearMinor: old,
    deltaPct: old > 0 ? Math.round(((cur / old) - 1) * 1000) / 10 : null,
  }
}
