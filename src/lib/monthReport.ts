// src/lib/monthReport.ts — Motore del Report mensile: il racconto del mese.
//
// A differenza di reports.ts (aggregati di un singolo mese, senza contesto),
// qui ogni numero arriva con la sua baseline: mese tipico (mediana 6 mesi
// completi precedenti), mese precedente, stesso mese dell'anno scorso.
// Il motore produce anche le quattro famiglie di insight del mese:
//   1. perché diverso dal tipico (bridge + verdetto)
//   2. novità e cambi prezzo (nuovi merchant, ricorrenti cessati, scontrini saliti)
//   3. pattern del mese (giorni no-spend, giorno più caro, weekend, quota vincolata)
//   4. ranking storico (posizione del mese, record di categoria, streak)
// Regola d'oro ereditata da insights.ts: sotto soglia di materialità il motore
// tace. Il silenzio è una feature.
import { sqlite } from '@/db'
import {
  buildFlowContext,
  fetchTrueExpenses,
  fetchTrueIncomes,
  flowTxnKey,
  median,
  IS_TRANSFER_SQL,
  type FlowContext,
  type FlowTxn,
} from '@/lib/spending'
import {
  monthBridge,
  COMMITTED_CATEGORIES,
  type MonthBridge,
} from '@/lib/spendingInsights'
import type { Insight, InsightSeverity, InsightIcon } from '@/lib/insights'

// ═══════════════════════════════════════════════════════════════════════════════
// TIPI
// ═══════════════════════════════════════════════════════════════════════════════

export interface MonthTxn {
  id:          number
  booked_date: string
  label:       string        // merchant o descrizione accorciata
  amountMinor: number        // positivo (assoluto)
}

export interface MonthCategoryRow {
  categoryId:   number | null
  categoryName: string
  color:        string | null
  totalMinor:   number        // positivo
  count:        number
  typicalMinor: number | null // mediana mensile su baseline (null se baseline assente)
  deltaMinor:   number | null // total − typical
  txns:         MonthTxn[]    // ordinate per importo desc
}

export interface MonthMerchantRow {
  key:          string
  label:        string
  categoryName: string | null
  totalMinor:   number
  count:        number
  isNew:        boolean       // mai visto prima di questo mese
  txns:         MonthTxn[]
}

export interface DailyCalPoint {
  day:          number        // 1..daysInMonth
  weekday:      number        // 0=dom .. 6=sab
  outflowMinor: number
  inflowMinor:  number
  isFuture:     boolean       // oltre oggi nel mese corrente
}

export interface MonthVerdict {
  /** Frase principale: la risposta in 5 secondi. */
  headline: string
  /** Dettaglio: i driver principali. */
  detail:   string | null
  tone:     'good' | 'bad' | 'neutral'
}

export interface NewMerchantItem  { label: string; totalMinor: number; count: number }
export interface CeasedItem       { label: string; monthlyMinor: number; monthsSeen: number }
export interface PriceMoveItem {
  label:             string
  monthMedianMinor:  number   // scontrino mediano nel mese focus
  baseMedianMinor:   number   // scontrino mediano nei 6 mesi precedenti
  deltaPct:          number
  count:             number   // scontrini nel mese
}

export interface MonthPatterns {
  noSpendDays:            number        // giorni senza uscite (fino a oggi se parziale)
  typicalNoSpendDays:     number | null // mediana su mesi completi baseline
  topDay:                 { day: number; totalMinor: number; topTxn: MonthTxn | null } | null
  weekendSharePct:        number | null // quota uscite sab+dom
  typicalWeekendSharePct: number | null
  committedMinor:         number        // categorie vincolate
  discretionaryMinor:     number
}

export interface CategoryRecord {
  categoryName: string
  totalMinor:   number
  kind:         'max' | 'min'
  monthsCompared: number
}

export interface MonthRanking {
  /** 1 = mese più costoso tra quelli confrontati. */
  rank:            number
  monthsCompared:  number
  medianOutflowMinor: number
  records:         CategoryRecord[]
  /** Mesi consecutivi (incluso il focus) con uscite sotto la mediana storica. */
  streakBelowMedian: number
}

export interface MonthReportData {
  month:           string
  isPartialMonth:  boolean
  daysInMonth:     number
  daysElapsed:     number
  hasData:         boolean

  totalOutflowMinor: number   // positivo
  totalInflowMinor:  number
  netMinor:          number   // inflow − outflow
  txCount:           number
  transfersOutMinor: number
  avgDailyMinor:     number   // outflow / giorni trascorsi

  baseline: {
    monthsInBaseline:       number
    typicalOutflowMinor:    number | null
    prevMonthOutflowMinor:  number | null
    prevMonth:              string | null
    yoyOutflowMinor:        number | null
    typicalInflowMinor:     number | null
  }

  verdict:    MonthVerdict | null
  bridge:     MonthBridge
  daily:      DailyCalPoint[]
  categories: MonthCategoryRow[]
  merchants:  MonthMerchantRow[]

  newMerchants: NewMerchantItem[]
  ceased:       CeasedItem[]
  priceMoves:   PriceMoveItem[]
  patterns:     MonthPatterns
  ranking:      MonthRanking | null

  insights: Insight[]

  uncategorized: { count: number; totalMinor: number }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function monthKey(iso: string): string { return iso.slice(0, 7) }

function prevMonthOf(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

function previousMonthsOf(yyyyMm: string, count: number): string[] {
  const out: string[] = []
  let cur = yyyyMm
  for (let i = 0; i < count; i++) { cur = prevMonthOf(cur); out.push(cur) }
  return out
}

function daysIn(yyyyMm: string): number {
  return new Date(Date.UTC(Number(yyyyMm.slice(0, 4)), Number(yyyyMm.slice(5, 7)), 0)).getUTCDate()
}

function eur(minor: number, decimals = 0): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  })
}
function fmtPctIt(n: number, decimals = 0): string {
  return n.toLocaleString('it-IT', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }) + '%'
}

const MONTH_NAMES = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
]
export function monthLabelIt(yyyyMm: string): string {
  return `${MONTH_NAMES[Number(yyyyMm.slice(5, 7)) - 1] ?? yyyyMm} ${yyyyMm.slice(0, 4)}`
}

function txnLabel(t: FlowTxn): string {
  const raw = t.merchant_name ?? t.description_raw
  return raw.length > 48 ? raw.slice(0, 48) + '…' : raw
}
function toMonthTxn(t: FlowTxn): MonthTxn {
  return { id: t.id, booked_date: t.booked_date, label: txnLabel(t), amountMinor: Math.abs(t.amount_minor) }
}

/** Somma delle uscite (positiva) di un array di FlowTxn. */
function sumAbs(txns: FlowTxn[]): number {
  return txns.reduce((s, t) => s + Math.abs(t.amount_minor), 0)
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOTORE
// ═══════════════════════════════════════════════════════════════════════════════

const NEW_MERCHANT_MIN_MINOR   = 1500  // €15 nel mese per contare come novità
const CEASED_MIN_MONTHLY_MINOR = 500   // €5/mese
const PRICE_MIN_MONTH_TXNS     = 2
const PRICE_MIN_BASE_TXNS      = 4
const PRICE_MIN_DELTA_PCT      = 8
const RECORD_MIN_MINOR         = 5000  // €50 per un record di categoria
const MAX_MONTH_INSIGHTS       = 6

export function buildMonthReport(
  userId: number,
  month: string,               // YYYY-MM già validato dal chiamante
  bankAccountId?: number,
  today = new Date(),
): MonthReportData {
  const ctx = buildFlowContext(userId)

  // Finestra dati: abbastanza storia per baseline (6 mesi) + YoY (12) rispetto
  // al mese selezionato, anche se è nel passato.
  const currentMonth = today.toISOString().slice(0, 7)
  const monthsBack = Math.min(
    48,
    monthsBetween(month, currentMonth) + 14,
  )
  let expenses = fetchTrueExpenses(ctx, monthsBack)
  let incomes  = fetchTrueIncomes(ctx, monthsBack)
  if (bankAccountId !== undefined) {
    expenses = expenses.filter((t) => t.bank_account_id === bankAccountId)
    incomes  = incomes.filter((t) => t.bank_account_id === bankAccountId)
  }

  const isPartialMonth = month === currentMonth
  const daysInMonth    = daysIn(month)
  const daysElapsed    = isPartialMonth ? Math.min(today.getUTCDate(), daysInMonth) : daysInMonth

  const monthExpenses = expenses.filter((t) => monthKey(t.booked_date) === month)
  const monthIncomes  = incomes.filter((t) => monthKey(t.booked_date) === month)

  const totalOutflow = sumAbs(monthExpenses)
  const totalInflow  = sumAbs(monthIncomes)
  const hasData      = monthExpenses.length > 0 || monthIncomes.length > 0

  // Trasferimenti in uscita del mese (esclusi dal report, mostrati come nota)
  const transfersOut = transfersOutOfMonth(ctx, month, bankAccountId)

  // ── Baseline ────────────────────────────────────────────────────────────────
  const baselineMonths = previousMonthsOf(month, 6)
    .filter((m) => m < currentMonth)  // solo mesi completi
  const outflowByMonth = new Map<string, number>()
  for (const t of expenses) {
    const m = monthKey(t.booked_date)
    outflowByMonth.set(m, (outflowByMonth.get(m) ?? 0) + Math.abs(t.amount_minor))
  }
  const inflowByMonth = new Map<string, number>()
  for (const t of incomes) {
    const m = monthKey(t.booked_date)
    inflowByMonth.set(m, (inflowByMonth.get(m) ?? 0) + Math.abs(t.amount_minor))
  }
  const baselineWithData = baselineMonths.filter((m) => outflowByMonth.has(m) || inflowByMonth.has(m))
  const typicalOutflow = baselineWithData.length >= 3
    ? Math.round(median(baselineWithData.map((m) => outflowByMonth.get(m) ?? 0)))
    : null
  const typicalInflow = baselineWithData.length >= 3
    ? Math.round(median(baselineWithData.map((m) => inflowByMonth.get(m) ?? 0)))
    : null
  const prevMonth = prevMonthOf(month)
  const prevMonthOutflow = outflowByMonth.has(prevMonth) ? outflowByMonth.get(prevMonth)! : null
  const yoyMonth = `${Number(month.slice(0, 4)) - 1}${month.slice(4)}`
  const yoyOutflow = outflowByMonth.has(yoyMonth) ? outflowByMonth.get(yoyMonth)! : null

  // ── Bridge per categoria sul mese selezionato ───────────────────────────────
  const bridge = monthBridge(expenses, today, month)

  // ── Calendario giornaliero completo (i giorni a zero esistono) ──────────────
  const daily: DailyCalPoint[] = []
  {
    const outByDay = new Array<number>(daysInMonth + 1).fill(0)
    const inByDay  = new Array<number>(daysInMonth + 1).fill(0)
    for (const t of monthExpenses) outByDay[Number(t.booked_date.slice(8, 10))] += Math.abs(t.amount_minor)
    for (const t of monthIncomes)  inByDay[Number(t.booked_date.slice(8, 10))]  += Math.abs(t.amount_minor)
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, d))
      daily.push({
        day: d,
        weekday: date.getUTCDay(),
        outflowMinor: outByDay[d],
        inflowMinor:  inByDay[d],
        isFuture:     isPartialMonth && d > daysElapsed,
      })
    }
  }

  // ── Categorie con baseline e drill-down ─────────────────────────────────────
  const typicalByCategory = new Map<string, number>()
  {
    // mediana mensile per categoria su baseline (zeri inclusi per i mesi con dati)
    const byMonthCat = new Map<string, Map<string, number>>()
    for (const t of expenses) {
      const m = monthKey(t.booked_date)
      if (!baselineWithData.includes(m)) continue
      let mm = byMonthCat.get(m)
      if (!mm) { mm = new Map(); byMonthCat.set(m, mm) }
      const key = String(t.category_id ?? 'none')
      mm.set(key, (mm.get(key) ?? 0) + Math.abs(t.amount_minor))
    }
    if (baselineWithData.length >= 3) {
      const allCats = new Set<string>()
      for (const mm of byMonthCat.values()) for (const k of mm.keys()) allCats.add(k)
      for (const cat of allCats) {
        const series = baselineWithData.map((m) => byMonthCat.get(m)?.get(cat) ?? 0)
        typicalByCategory.set(cat, Math.round(median(series)))
      }
    }
  }
  const categoryColors = fetchCategoryColors()
  const categories: MonthCategoryRow[] = []
  {
    const grouped = new Map<string, { id: number | null; name: string; txns: FlowTxn[] }>()
    for (const t of monthExpenses) {
      const key = String(t.category_id ?? 'none')
      let g = grouped.get(key)
      if (!g) {
        g = { id: t.category_id, name: t.category_name ?? 'Senza categoria', txns: [] }
        grouped.set(key, g)
      }
      g.txns.push(t)
    }
    for (const [key, g] of grouped) {
      const total = sumAbs(g.txns)
      const typical = typicalByCategory.has(key) ? typicalByCategory.get(key)! : null
      categories.push({
        categoryId:   g.id,
        categoryName: g.name,
        color:        g.id !== null ? categoryColors.get(g.id) ?? null : null,
        totalMinor:   total,
        count:        g.txns.length,
        typicalMinor: typical,
        deltaMinor:   typical !== null ? total - typical : null,
        txns:         g.txns.map(toMonthTxn).sort((a, b) => b.amountMinor - a.amountMinor).slice(0, 50),
      })
    }
    categories.sort((a, b) => b.totalMinor - a.totalMinor)
  }

  // ── Merchant del mese + novità ──────────────────────────────────────────────
  const firstSeenByKey = new Map<string, string>()  // key → primo mese visto
  for (const t of expenses) {
    const key = flowTxnKey(t)
    if (!key) continue
    const m = monthKey(t.booked_date)
    const cur = firstSeenByKey.get(key)
    if (cur === undefined || m < cur) firstSeenByKey.set(key, m)
  }

  const merchants: MonthMerchantRow[] = []
  {
    const grouped = new Map<string, { label: string; categoryName: string | null; txns: FlowTxn[] }>()
    for (const t of monthExpenses) {
      const key = flowTxnKey(t)
      if (!key) continue
      let g = grouped.get(key)
      if (!g) {
        g = { label: txnLabel(t), categoryName: t.category_name, txns: [] }
        grouped.set(key, g)
      }
      g.txns.push(t)
    }
    for (const [key, g] of grouped) {
      merchants.push({
        key,
        label:        g.label,
        categoryName: g.categoryName,
        totalMinor:   sumAbs(g.txns),
        count:        g.txns.length,
        isNew:        firstSeenByKey.get(key) === month && baselineWithData.length >= 3,
        txns:         g.txns.map(toMonthTxn).sort((a, b) => b.amountMinor - a.amountMinor).slice(0, 30),
      })
    }
    merchants.sort((a, b) => b.totalMinor - a.totalMinor)
  }

  const newMerchants: NewMerchantItem[] = merchants
    .filter((m) => m.isNew && m.totalMinor >= NEW_MERCHANT_MIN_MINOR)
    .slice(0, 6)
    .map((m) => ({ label: m.label, totalMinor: m.totalMinor, count: m.count }))

  // Ricorrenti cessati: presenti in ciascuno degli ultimi 3 mesi completi
  // prima del focus, assenti nel focus (solo per mesi completi).
  const ceased: CeasedItem[] = []
  if (!isPartialMonth && baselineWithData.length >= 3) {
    const last3 = previousMonthsOf(month, 3)
    const monthsByKey = new Map<string, Map<string, number>>()  // key → month → spend
    const labels = new Map<string, string>()
    for (const t of expenses) {
      const m = monthKey(t.booked_date)
      if (m !== month && !last3.includes(m)) continue
      const key = flowTxnKey(t)
      if (!key) continue
      labels.set(key, txnLabel(t))
      let mm = monthsByKey.get(key)
      if (!mm) { mm = new Map(); monthsByKey.set(key, mm) }
      mm.set(m, (mm.get(m) ?? 0) + Math.abs(t.amount_minor))
    }
    for (const [key, mm] of monthsByKey) {
      if (mm.has(month)) continue
      if (!last3.every((m) => mm.has(m))) continue
      const monthly = Math.round(median(last3.map((m) => mm.get(m)!)))
      if (monthly < CEASED_MIN_MONTHLY_MINOR) continue
      ceased.push({ label: labels.get(key)!, monthlyMinor: monthly, monthsSeen: 3 })
    }
    ceased.sort((a, b) => b.monthlyMinor - a.monthlyMinor)
    ceased.splice(6)
  }

  // Cambi prezzo: scontrino mediano del mese vs 6 mesi precedenti
  const priceMoves: PriceMoveItem[] = []
  {
    const baseSet = new Set(baselineMonths)
    const monthReceipts = new Map<string, number[]>()
    const baseReceipts  = new Map<string, number[]>()
    const labels = new Map<string, string>()
    for (const t of expenses) {
      const m = monthKey(t.booked_date)
      const key = flowTxnKey(t)
      if (!key) continue
      if (m === month) {
        labels.set(key, txnLabel(t))
        let arr = monthReceipts.get(key)
        if (!arr) { arr = []; monthReceipts.set(key, arr) }
        arr.push(Math.abs(t.amount_minor))
      } else if (baseSet.has(m)) {
        let arr = baseReceipts.get(key)
        if (!arr) { arr = []; baseReceipts.set(key, arr) }
        arr.push(Math.abs(t.amount_minor))
      }
    }
    for (const [key, cur] of monthReceipts) {
      const base = baseReceipts.get(key)
      if (!base || cur.length < PRICE_MIN_MONTH_TXNS || base.length < PRICE_MIN_BASE_TXNS) continue
      const curMed  = median(cur)
      const baseMed = median(base)
      if (baseMed < 200) continue  // scontrini sotto €2: rumore
      const deltaPct = Math.round(((curMed / baseMed) - 1) * 1000) / 10
      if (Math.abs(deltaPct) < PRICE_MIN_DELTA_PCT) continue
      priceMoves.push({
        label:            labels.get(key)!,
        monthMedianMinor: Math.round(curMed),
        baseMedianMinor:  Math.round(baseMed),
        deltaPct,
        count:            cur.length,
      })
    }
    priceMoves.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))
    priceMoves.splice(6)
  }

  // ── Pattern del mese ────────────────────────────────────────────────────────
  const patterns = computePatterns(
    daily, daysElapsed, monthExpenses, expenses, baselineWithData,
  )

  // ── Ranking storico (solo mesi completi) ────────────────────────────────────
  let ranking: MonthRanking | null = null
  if (!isPartialMonth) {
    const compared = [month, ...previousMonthsOf(month, 11)]
      .filter((m) => outflowByMonth.has(m) && m <= month)
    if (compared.length >= 4 && outflowByMonth.has(month)) {
      const totals = compared.map((m) => outflowByMonth.get(m)!)
      const med    = Math.round(median(totals))
      const sortedDesc = [...compared].sort((a, b) => outflowByMonth.get(b)! - outflowByMonth.get(a)!)
      const rank = sortedDesc.indexOf(month) + 1

      // Record di categoria: max/min del mese su ≥4 mesi confrontabili
      const records: CategoryRecord[] = []
      const byMonthCat = new Map<string, Map<string, number>>()
      const catNames = new Map<string, string>()
      for (const t of expenses) {
        const m = monthKey(t.booked_date)
        if (!compared.includes(m)) continue
        const key = String(t.category_id ?? 'none')
        catNames.set(key, t.category_name ?? 'Senza categoria')
        let mm = byMonthCat.get(key)
        if (!mm) { mm = new Map(); byMonthCat.set(key, mm) }
        mm.set(m, (mm.get(m) ?? 0) + Math.abs(t.amount_minor))
      }
      for (const [key, mm] of byMonthCat) {
        const cur = mm.get(month)
        if (cur === undefined || cur < RECORD_MIN_MINOR) continue
        const monthsWithCat = [...mm.keys()]
        if (monthsWithCat.length < 4) continue
        const vals = monthsWithCat.map((m) => mm.get(m)!)
        if (cur >= Math.max(...vals)) {
          records.push({ categoryName: catNames.get(key)!, totalMinor: cur, kind: 'max', monthsCompared: monthsWithCat.length })
        } else if (cur <= Math.min(...vals)) {
          records.push({ categoryName: catNames.get(key)!, totalMinor: cur, kind: 'min', monthsCompared: monthsWithCat.length })
        }
      }
      records.sort((a, b) => b.totalMinor - a.totalMinor)
      records.splice(4)

      // Streak: mesi consecutivi (dal focus a ritroso) sotto la mediana storica
      let streak = 0
      for (const m of [month, ...previousMonthsOf(month, 11)]) {
        const v = outflowByMonth.get(m)
        if (v === undefined || v > med) break
        streak++
      }

      ranking = {
        rank,
        monthsCompared: compared.length,
        medianOutflowMinor: med,
        records,
        streakBelowMedian: streak,
      }
    }
  }

  // ── Verdetto ────────────────────────────────────────────────────────────────
  const verdict = buildVerdict({
    month, isPartialMonth, daysElapsed, daysInMonth,
    totalOutflow, typicalOutflow, bridge,
  })

  // ── Considerazioni del mese ─────────────────────────────────────────────────
  const miscategorizedOutMinor = sumAbs(
    monthExpenses.filter((t) => t.category_kind === 'income'),
  )
  const insights = buildMonthInsights({
    month, isPartialMonth, totalOutflow, typicalOutflow,
    bridge, newMerchants, ceased, priceMoves, patterns, ranking,
    miscategorizedOutMinor,
  })

  // ── Non categorizzati ───────────────────────────────────────────────────────
  const uncat = monthExpenses.filter((t) => t.category_id === null)

  return {
    month,
    isPartialMonth,
    daysInMonth,
    daysElapsed,
    hasData,
    totalOutflowMinor: totalOutflow,
    totalInflowMinor:  totalInflow,
    netMinor:          totalInflow - totalOutflow,
    txCount:           monthExpenses.length + monthIncomes.length,
    transfersOutMinor: transfersOut,
    avgDailyMinor:     daysElapsed > 0 ? Math.round(totalOutflow / daysElapsed) : 0,
    baseline: {
      monthsInBaseline:      baselineWithData.length,
      typicalOutflowMinor:   typicalOutflow,
      prevMonthOutflowMinor: prevMonthOutflow,
      prevMonth:             prevMonthOutflow !== null ? prevMonth : null,
      yoyOutflowMinor:       yoyOutflow,
      typicalInflowMinor:    typicalInflow,
    },
    verdict,
    bridge,
    daily,
    categories,
    merchants: merchants.slice(0, 12),
    newMerchants,
    ceased,
    priceMoves,
    patterns,
    ranking,
    insights,
    uncategorized: { count: uncat.length, totalMinor: sumAbs(uncat) },
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOTTO-FUNZIONI
// ═══════════════════════════════════════════════════════════════════════════════

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return Math.max(0, (ty - fy) * 12 + (tm - fm))
}

function transfersOutOfMonth(ctx: FlowContext, month: string, bankAccountId?: number): number {
  const accountFilter = bankAccountId !== undefined ? 'AND t.bank_account_id = :account' : ''
  const row = sqlite
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN ${IS_TRANSFER_SQL} AND t.amount_minor < 0 THEN -t.amount_minor ELSE 0 END), 0) AS out
       FROM transactions t
       WHERE t.owner_id = :owner AND substr(t.booked_date, 1, 7) = :month ${accountFilter}`,
    )
    .get({
      owner:    ctx.userId,
      month,
      excluded: ctx.excludedIdsJson,
      ...(bankAccountId !== undefined ? { account: bankAccountId } : {}),
    }) as { out: number }
  return row.out
}

function fetchCategoryColors(): Map<number, string | null> {
  const rows = sqlite
    .prepare(`SELECT id, color FROM categories`)
    .all() as { id: number; color: string | null }[]
  return new Map(rows.map((r) => [r.id, r.color]))
}

function computePatterns(
  daily: DailyCalPoint[],
  daysElapsed: number,
  monthExpenses: FlowTxn[],
  allExpenses: FlowTxn[],
  baselineWithData: string[],
): MonthPatterns {
  const elapsed = daily.filter((d) => d.day <= daysElapsed)
  const noSpendDays = elapsed.filter((d) => d.outflowMinor === 0).length

  // Baseline no-spend: mediana dei giorni a zero nei mesi completi baseline
  let typicalNoSpend: number | null = null
  if (baselineWithData.length >= 3) {
    const counts = baselineWithData.map((m) => {
      const spentDays = new Set(
        allExpenses.filter((t) => monthKey(t.booked_date) === m)
          .map((t) => t.booked_date.slice(8, 10)),
      )
      return daysIn(m) - spentDays.size
    })
    typicalNoSpend = Math.round(median(counts))
  }

  // Giorno più caro + transazione dominante
  let topDay: MonthPatterns['topDay'] = null
  const maxDay = elapsed.reduce<DailyCalPoint | null>(
    (best, d) => (d.outflowMinor > (best?.outflowMinor ?? 0) ? d : best), null,
  )
  if (maxDay && maxDay.outflowMinor > 0) {
    const dayStr = String(maxDay.day).padStart(2, '0')
    const dayTxns = monthExpenses
      .filter((t) => t.booked_date.slice(8, 10) === dayStr)
      .sort((a, b) => Math.abs(b.amount_minor) - Math.abs(a.amount_minor))
    topDay = {
      day: maxDay.day,
      totalMinor: maxDay.outflowMinor,
      topTxn: dayTxns.length > 0 ? toMonthTxn(dayTxns[0]) : null,
    }
  }

  // Quota weekend
  const totalOut = elapsed.reduce((s, d) => s + d.outflowMinor, 0)
  const weekendOut = elapsed
    .filter((d) => d.weekday === 0 || d.weekday === 6)
    .reduce((s, d) => s + d.outflowMinor, 0)
  const weekendSharePct = totalOut > 0 ? Math.round((weekendOut / totalOut) * 1000) / 10 : null

  let typicalWeekendSharePct: number | null = null
  if (baselineWithData.length >= 3) {
    const shares: number[] = []
    for (const m of baselineWithData) {
      let tot = 0, wk = 0
      for (const t of allExpenses) {
        if (monthKey(t.booked_date) !== m) continue
        const abs = Math.abs(t.amount_minor)
        tot += abs
        const wd = new Date(t.booked_date + 'T00:00:00Z').getUTCDay()
        if (wd === 0 || wd === 6) wk += abs
      }
      if (tot > 0) shares.push((wk / tot) * 100)
    }
    if (shares.length >= 3) typicalWeekendSharePct = Math.round(median(shares) * 10) / 10
  }

  // Vincolato vs discrezionale
  let committed = 0, discretionary = 0
  for (const t of monthExpenses) {
    const abs = Math.abs(t.amount_minor)
    if (t.category_name !== null && COMMITTED_CATEGORIES.has(t.category_name)) committed += abs
    else discretionary += abs
  }

  return {
    noSpendDays,
    typicalNoSpendDays: typicalNoSpend,
    topDay,
    weekendSharePct,
    typicalWeekendSharePct,
    committedMinor: committed,
    discretionaryMinor: discretionary,
  }
}

interface VerdictInputs {
  month:          string
  isPartialMonth: boolean
  daysElapsed:    number
  daysInMonth:    number
  totalOutflow:   number
  typicalOutflow: number | null
  bridge:         MonthBridge
}

function buildVerdict(v: VerdictInputs): MonthVerdict | null {
  if (v.typicalOutflow === null || v.typicalOutflow === 0) {
    if (v.totalOutflow === 0) return null
    return {
      headline: `${cap(monthLabelIt(v.month))}: ${eur(v.totalOutflow)} di uscite. Ancora pochi mesi di storico per dirti se è tanto o poco.`,
      detail: null,
      tone: 'neutral',
    }
  }

  // Per il mese parziale confrontiamo con il tipico pro-rata sui giorni trascorsi:
  // approssimazione lineare, dichiarata nel testo come "ritmo".
  const reference = v.isPartialMonth
    ? Math.round(v.typicalOutflow * (v.daysElapsed / v.daysInMonth))
    : v.typicalOutflow
  if (reference === 0) return null

  const deltaPct = Math.round(((v.totalOutflow - reference) / reference) * 100)
  const absDelta = Math.abs(v.totalOutflow - reference)

  const driver = v.bridge.hasData && !v.isPartialMonth && v.bridge.items.length > 0
    ? v.bridge.items[0]
    : null
  const detail = driver && Math.abs(driver.deltaMinor) >= 3000
    ? `${driver.deltaMinor > 0 ? 'Il grosso viene da' : 'Merito soprattutto di'} ${driver.categoryName}: ${eur(driver.actualMinor)} contro un tipico di ${eur(driver.typicalMinor)}.`
    : null

  const label = cap(monthLabelIt(v.month))
  if (deltaPct >= 10 && absDelta >= 5000) {
    return {
      headline: v.isPartialMonth
        ? `Al giorno ${v.daysElapsed} hai speso ${eur(v.totalOutflow)}: il ${fmtPctIt(deltaPct)} sopra il tuo ritmo tipico (${eur(reference)}).`
        : `${label}: ${eur(v.totalOutflow)} di uscite, il ${fmtPctIt(deltaPct)} sopra il tuo mese tipico (${eur(v.typicalOutflow)}).`,
      detail,
      tone: 'bad',
    }
  }
  if (deltaPct <= -10 && absDelta >= 5000) {
    return {
      headline: v.isPartialMonth
        ? `Al giorno ${v.daysElapsed} hai speso ${eur(v.totalOutflow)}: il ${fmtPctIt(-deltaPct)} sotto il tuo ritmo tipico (${eur(reference)}).`
        : `${label}: ${eur(v.totalOutflow)} di uscite, il ${fmtPctIt(-deltaPct)} sotto il tuo mese tipico (${eur(v.typicalOutflow)}).`,
      detail,
      tone: 'good',
    }
  }
  return {
    headline: v.isPartialMonth
      ? `Al giorno ${v.daysElapsed} hai speso ${eur(v.totalOutflow)}: in linea con il tuo ritmo tipico (${eur(reference)}).`
      : `${label}: ${eur(v.totalOutflow)} di uscite, in linea con il tuo mese tipico (${eur(v.typicalOutflow)}).`,
    detail,
    tone: 'neutral',
  }
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1) }

interface MonthInsightInputs {
  month:          string
  isPartialMonth: boolean
  totalOutflow:   number
  typicalOutflow: number | null
  bridge:         MonthBridge
  newMerchants:   NewMerchantItem[]
  ceased:         CeasedItem[]
  priceMoves:     PriceMoveItem[]
  patterns:       MonthPatterns
  ranking:        MonthRanking | null
  /** Uscite del mese con categoria di tipo 'income' (giroconti mal categorizzati). */
  miscategorizedOutMinor: number
}

const SEVERITY_ORDER: Record<InsightSeverity, number> = {
  critical: 0, warn: 1, opportunity: 2, info: 3,
}

function buildMonthInsights(i: MonthInsightInputs): Insight[] {
  const out: Insight[] = []
  const push = (
    id: string, severity: InsightSeverity, icon: InsightIcon,
    title: string, body: string, impactMinor: number, impactLabel?: string,
  ) => out.push({ id, severity, icon, title, body, impactMinor, impactLabel })

  // 0. Qualità dati: uscite con categoria di tipo Entrate falsano tutto il resto
  if (i.miscategorizedOutMinor >= 10000) {
    push(
      'miscategorized', 'warn', 'alert',
      'Movimenti da ricategorizzare',
      `${eur(i.miscategorizedOutMinor)} di uscite hanno una categoria di tipo Entrate: quasi sempre sono bonifici verso conti propri non collegati. Finché restano così, verdetto e confronti del mese sono gonfiati.`,
      i.miscategorizedOutMinor,
      `${eur(i.miscategorizedOutMinor)} sospetti`,
    )
  }

  // 1. Driver del bridge oltre il primo (il primo è già nel verdetto)
  if (i.bridge.hasData && !i.isPartialMonth) {
    for (const item of i.bridge.items.slice(1, 3)) {
      if (Math.abs(item.deltaMinor) < 4000) continue
      const up = item.deltaMinor > 0
      push(
        `bridge:${item.categoryId ?? 'none'}`,
        up ? 'warn' : 'opportunity',
        'scale',
        `${item.categoryName}: ${up ? 'sopra' : 'sotto'} il tipico`,
        `${eur(item.actualMinor)} questo mese contro una mediana di ${eur(item.typicalMinor)} negli ultimi ${i.bridge.monthsInBaseline} mesi.`,
        Math.abs(item.deltaMinor),
        `${item.deltaMinor > 0 ? '+' : '−'}${eur(Math.abs(item.deltaMinor))} nel mese`,
      )
    }
  }

  // 2. Nuovi merchant che pesano
  if (i.newMerchants.length > 0 && i.totalOutflow > 0) {
    const totalNew = i.newMerchants.reduce((s, m) => s + m.totalMinor, 0)
    const share = (totalNew / i.totalOutflow) * 100
    if (totalNew >= 3000 && share >= 4) {
      const names = i.newMerchants.slice(0, 3).map((m) => m.label).join(', ')
      push(
        'new-merchants', share >= 15 ? 'warn' : 'info', 'alert',
        `${i.newMerchants.length === 1 ? 'Un esercente nuovo' : `${i.newMerchants.length} esercenti nuovi`} nel mese`,
        `${names}${i.newMerchants.length > 3 ? ' e altri' : ''}: ${eur(totalNew)} in posti dove non avevi mai speso prima — il ${fmtPctIt(Math.round(share))} delle uscite del mese.`,
        totalNew,
        `${eur(totalNew)} nel mese`,
      )
    }
  }

  // 3. Ricorrente cessato = risparmio strutturale
  for (const c of i.ceased.slice(0, 2)) {
    push(
      `ceased:${c.label}`, 'opportunity', 'piggy',
      `${c.label}: nessun addebito questo mese`,
      `Compariva ogni mese (~${eur(c.monthlyMinor)}). Se l'hai disdetto sono ${eur(c.monthlyMinor * 12)} l'anno che restano tuoi; se non l'hai disdetto, aspettati un recupero.`,
      c.monthlyMinor * 12,
      `${eur(c.monthlyMinor * 12)}/anno`,
    )
  }

  // 4. Scontrino salito (inflazione personale del mese)
  const topMove = i.priceMoves.find((p) => p.deltaPct > 0)
  if (topMove) {
    const monthlyImpact = (topMove.monthMedianMinor - topMove.baseMedianMinor) * topMove.count
    if (monthlyImpact >= 500) {
      push(
        `price:${topMove.label}`, 'warn', 'trend',
        `${topMove.label}: scontrino su del ${fmtPctIt(topMove.deltaPct, 1)}`,
        `Lo scontrino mediano è passato da ${eur(topMove.baseMedianMinor, 2)} a ${eur(topMove.monthMedianMinor, 2)}. Su ${topMove.count} passaggi nel mese fanno ${eur(monthlyImpact)} in più.`,
        monthlyImpact * 12,
        `+${eur(monthlyImpact)} nel mese`,
      )
    }
  }

  // 5. Concentrazione: un giorno pesa troppo
  if (i.patterns.topDay && i.totalOutflow > 0) {
    const share = (i.patterns.topDay.totalMinor / i.totalOutflow) * 100
    if (share >= 25 && i.patterns.topDay.totalMinor >= 10000) {
      const t = i.patterns.topDay.topTxn
      push(
        'top-day', 'info', 'calendar',
        `Il giorno ${i.patterns.topDay.day} vale il ${fmtPctIt(Math.round(share))} del mese`,
        `${eur(i.patterns.topDay.totalMinor)} in un solo giorno${t ? `, guidato da ${t.label} (${eur(t.amountMinor)})` : ''}. Tolto quel giorno, il mese è nella norma.`,
        i.patterns.topDay.totalMinor,
      )
    }
  }

  // 6. Weekend anomalo
  if (i.patterns.weekendSharePct !== null && i.patterns.typicalWeekendSharePct !== null) {
    const diff = i.patterns.weekendSharePct - i.patterns.typicalWeekendSharePct
    if (diff >= 12) {
      push(
        'weekend', 'info', 'calendar',
        'Mese sbilanciato sul weekend',
        `Il ${fmtPctIt(i.patterns.weekendSharePct, 1)} delle uscite è caduto di sabato o domenica, contro un tipico ${fmtPctIt(i.patterns.typicalWeekendSharePct, 1)}.`,
        0,
      )
    }
  }

  // 7. No-spend: momento positivo
  if (
    !i.isPartialMonth
    && i.patterns.typicalNoSpendDays !== null
    && i.patterns.noSpendDays >= i.patterns.typicalNoSpendDays + 3
  ) {
    push(
      'no-spend', 'opportunity', 'piggy',
      `${i.patterns.noSpendDays} giorni senza spese`,
      `Il tuo tipico è ${i.patterns.typicalNoSpendDays}. Più giorni a zero = meno acquisti d'impulso: qualunque cosa tu stia facendo, funziona.`,
      0,
    )
  }

  // 8. Ranking estremi
  if (i.ranking && i.ranking.monthsCompared >= 6) {
    if (i.ranking.rank === 1) {
      push(
        'rank-max', 'warn', 'trend',
        `Il mese più costoso degli ultimi ${i.ranking.monthsCompared}`,
        `${eur(i.totalOutflow)} di uscite contro una mediana di ${eur(i.ranking.medianOutflowMinor)}. Guarda il ponte delle categorie per capire da dove arriva.`,
        i.totalOutflow - i.ranking.medianOutflowMinor,
      )
    } else if (i.ranking.rank === i.ranking.monthsCompared) {
      push(
        'rank-min', 'opportunity', 'piggy',
        `Il mese più leggero degli ultimi ${i.ranking.monthsCompared}`,
        `${eur(i.totalOutflow)} di uscite contro una mediana di ${eur(i.ranking.medianOutflowMinor)}.`,
        i.ranking.medianOutflowMinor - i.totalOutflow,
      )
    }
    if (i.ranking.streakBelowMedian >= 3) {
      push(
        'streak', 'opportunity', 'trend',
        `${i.ranking.streakBelowMedian} mesi di fila sotto la tua mediana`,
        `Le uscite sono sotto la mediana storica da ${i.ranking.streakBelowMedian} mesi consecutivi: il trend è tuo amico.`,
        0,
      )
    }
  }

  out.sort((a, b) =>
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    || b.impactMinor - a.impactMinor,
  )
  return out.slice(0, MAX_MONTH_INSIGHTS)
}

/** Elenco mesi disponibili (YYYY-MM) per utente/conto. Riesportato per comodità. */
export { availableMonths } from '@/lib/reports'
