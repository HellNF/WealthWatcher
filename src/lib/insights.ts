// src/lib/insights.ts — Motore delle "Considerazioni".
// Trasforma le statistiche già calcolate in una lista ordinata di insight
// narrativi in italiano, ciascuno con impatto economico annualizzato.
// Regola d'oro: ogni insight ha una soglia di materialità — sotto soglia il
// motore tace. Il silenzio è una feature, non un difetto.
import type {
  CashflowForecastStats,
  MonthlyCashflow,
  RecurringItem,
  SpendingOutlier,
} from '@/lib/analytics'
import type {
  FixedVariableSplit,
  IncomeProfile,
  MerchantConcentration,
  MiscategorizedFlows,
  MonthBridge,
  MonthPacing,
  PersonalInflation,
  SameMonthYoY,
} from '@/lib/spendingInsights'
import { median } from '@/lib/spending'

export type InsightSeverity = 'critical' | 'warn' | 'opportunity' | 'info'
export type InsightIcon =
  | 'trend' | 'repeat' | 'alert' | 'piggy' | 'calendar' | 'scale' | 'coins'

export interface Insight {
  /** Id stabile, es. 'price-increase:m:12'. */
  id:          string
  severity:    InsightSeverity
  icon:        InsightIcon
  title:       string
  /** Corpo in italiano con i numeri già formattati. */
  body:        string
  /** Impatto economico in minor units (per il ranking; 0 = puro info). */
  impactMinor: number
  /** Etichetta dell'impatto già formattata (es. "+156 €/anno", "+80 € nel mese"). */
  impactLabel?: string
  href?:       string
}

export interface InsightInputs {
  cashflow:      MonthlyCashflow[]
  recurring:     RecurringItem[]
  outliers:      SpendingOutlier[]
  bridge:        MonthBridge
  fixedVar:      FixedVariableSplit
  inflation:     PersonalInflation
  income:        IncomeProfile
  pacing:        MonthPacing
  concentration: MerchantConcentration
  yoy:           SameMonthYoY
  miscategorized: MiscategorizedFlows
  forecast:      CashflowForecastStats
  pairCount:     number
  hasMultipleCurrencies: boolean
  /** Liquidità oltre il buffer di emergenza (da dcaRecommendationStats), se nota. */
  excessCashMinor?: number
  today?:        Date
}

// ── Formattazione (server-side, it-IT) ────────────────────────────────────────

function eur(minor: number, decimals = 0): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  })
}
function pct(n: number, decimals = 1): string {
  return n.toLocaleString('it-IT', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }) + '%'
}
const MONTH_NAMES = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
]
function monthName(yyyyMm: string): string {
  return MONTH_NAMES[Number(yyyyMm.slice(5, 7)) - 1] ?? yyyyMm
}

const SEVERITY_ORDER: Record<InsightSeverity, number> = {
  critical: 0, warn: 1, opportunity: 2, info: 3,
}

const MAX_INSIGHTS = 8

/** Genera la lista ordinata di considerazioni. Nessuna query: input già calcolati. */
export function computeInsights(inputs: InsightInputs): Insight[] {
  const out: Insight[] = []
  const today = inputs.today ?? new Date()
  const currentMonth = today.toISOString().slice(0, 7)

  const completeCashflow = inputs.cashflow.filter((c) => c.month < currentMonth)
  const annualExpenses = completeCashflow.slice(-12).reduce((s, c) => s + c.outflow, 0)

  // ── critical: liquidità sotto soglia ────────────────────────────────────────
  if (inputs.forecast.hasData && inputs.forecast.crossesThresholdInDays !== null) {
    out.push({
      id: 'runway-low',
      severity: 'critical',
      icon: 'alert',
      title: 'Liquidità in esaurimento',
      body: `Al ritmo attuale il saldo liquido scende sotto un mese di spese (${eur(inputs.forecast.thresholdMinor)}) entro ${inputs.forecast.crossesThresholdInDays} giorni. Riduci le uscite o rientra da risparmi/investimenti.`,
      impactMinor: Math.abs(inputs.forecast.avgMonthlyNetMinor) * 12,
    })
  }

  // ── warn: aumenti di prezzo sugli abbonamenti ───────────────────────────────
  for (const r of inputs.recurring) {
    if (r.status !== 'active' || r.priceChangePct === null || r.oldAmountMinor === null) continue
    if (r.priceChangePct <= 0) continue
    const factor = r.amountMinor > 0 ? r.yearlyMinor / r.amountMinor : 0
    const yearlyDelta = Math.round((r.amountMinor - r.oldAmountMinor) * factor)
    if (yearlyDelta < 1200) continue // < €12/anno: rumore
    out.push({
      id: `price-increase:${r.key}`,
      severity: 'warn',
      icon: 'repeat',
      title: `${r.description}: prezzo aumentato`,
      body: `L'addebito è passato da ${eur(r.oldAmountMinor, 2)} a ${eur(r.amountMinor, 2)} (${pct(r.priceChangePct)}). Su base annua sono ${eur(yearlyDelta)} in più: vale ancora quello che paghi?`,
      impactMinor: yearlyDelta,
      impactLabel: `+${eur(yearlyDelta)}/anno`,
    })
  }

  // ── opportunity: abbonamenti cessati ────────────────────────────────────────
  // Solo subscription/bill: una spesa abituale (es. supermercato) che si
  // interrompe non è un abbonamento da verificare.
  for (const r of inputs.recurring) {
    if (r.status !== 'ceased' || r.kind === 'habit' || r.yearlyMinor < 5000) continue
    out.push({
      id: `ceased-recurring:${r.key}`,
      severity: 'opportunity',
      icon: 'repeat',
      title: `${r.description}: pagamento cessato`,
      body: `Non vedo addebiti dal ${new Date(r.lastDate + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}. Se l'hai disdetto, sono ${eur(r.yearlyMinor)}/anno risparmiati; se non sei stato tu, verifica che il servizio sia ancora attivo.`,
      impactMinor: r.yearlyMinor,
      impactLabel: `≈ ${eur(r.yearlyMinor)}/anno`,
    })
  }

  // ── info: nuovi ricorrenti ──────────────────────────────────────────────────
  const sixtyDaysAgo = new Date(today.getTime() - 60 * 86_400_000).toISOString().slice(0, 10)
  for (const r of inputs.recurring) {
    if (r.status !== 'active' || r.kind === 'habit') continue
    if (r.firstDate < sixtyDaysAgo || r.yearlyMinor < 5000) continue
    out.push({
      id: `new-recurring:${r.key}`,
      severity: 'info',
      icon: 'repeat',
      title: `Nuovo pagamento ricorrente: ${r.description}`,
      body: `Rilevato un addebito ${r.cadenceLabel ?? 'ricorrente'} di ${eur(r.amountMinor, 2)} iniziato di recente: a regime sono ${eur(r.yearlyMinor)}/anno.`,
      impactMinor: r.yearlyMinor,
      impactLabel: `≈ ${eur(r.yearlyMinor)}/anno`,
    })
  }

  // ── warn: driver del mese (bridge) ──────────────────────────────────────────
  if (inputs.bridge.hasData) {
    const drivers = inputs.bridge.items
      .filter((i) => i.deltaMinor >= 5000 && (i.typicalMinor === 0 || i.deltaMinor >= i.typicalMinor * 0.25))
      .slice(0, 2)
    for (const d of drivers) {
      const monthLabel = monthName(inputs.bridge.month)
      out.push({
        id: `bridge-driver:${d.categoryId ?? 'none'}`,
        severity: 'warn',
        icon: 'scale',
        title: `${d.categoryName}: sopra il tuo mese tipico`,
        body: d.typicalMinor > 0
          ? `A ${monthLabel} hai speso ${eur(d.actualMinor)} in ${d.categoryName}, contro un mese tipico di ${eur(d.typicalMinor)}: ${eur(d.deltaMinor)} in più. Se diventasse la nuova normalità, sarebbero ${eur(d.deltaMinor * 12)}/anno.`
          : `A ${monthLabel} sono comparsi ${eur(d.actualMinor)} in ${d.categoryName}, una voce che normalmente non hai.`,
        impactMinor: d.deltaMinor * 12,
        impactLabel: `+${eur(d.deltaMinor)} nel mese`,
        href: '/dashboard/reports',
      })
    }
    if (inputs.bridge.totalDeltaMinor <= -10000) {
      out.push({
        id: 'bridge-good',
        severity: 'info',
        icon: 'piggy',
        title: 'Mese più leggero del solito',
        body: `A ${monthName(inputs.bridge.month)} hai speso ${eur(Math.abs(inputs.bridge.totalDeltaMinor))} meno del tuo mese tipico (${eur(inputs.bridge.totalTypicalMinor)}). Mantenendo il ritmo sono ${eur(Math.abs(inputs.bridge.totalDeltaMinor) * 12)}/anno.`,
        impactMinor: Math.abs(inputs.bridge.totalDeltaMinor) * 12,
        impactLabel: `−${eur(Math.abs(inputs.bridge.totalDeltaMinor))} nel mese`,
      })
    }
  }

  // ── warn: crollo del tasso di risparmio ─────────────────────────────────────
  if (completeCashflow.length >= 7) {
    const last = completeCashflow.at(-1)!
    const baseline = completeCashflow.slice(-7, -1)
      .map((c) => c.expenseSavingsRate)
      .filter((v): v is number => v !== null)
    if (last.expenseSavingsRate !== null && baseline.length >= 4) {
      const med = median(baseline)
      const dropPp = med - last.expenseSavingsRate
      if (dropPp >= 10 && last.inflow > 0) {
        const impact = Math.round((dropPp / 100) * last.inflow * 12)
        out.push({
          id: 'savings-rate-drop',
          severity: 'warn',
          icon: 'trend',
          title: 'Tasso di risparmio in calo',
          body: `A ${monthName(last.month)} hai risparmiato il ${pct(last.expenseSavingsRate)} delle entrate, contro una tua mediana del ${pct(med)}: ${pct(dropPp, 0)} in meno, pari a circa ${eur(Math.round((dropPp / 100) * last.inflow))} nel mese.`,
          impactMinor: impact,
          impactLabel: `≈ ${eur(Math.round((dropPp / 100) * last.inflow))} nel mese`,
        })
      }
    }
  }

  // ── warn: quota di spese incomprimibili alta ────────────────────────────────
  if (inputs.fixedVar.hasData && inputs.fixedVar.committedRatioPct !== null
      && inputs.fixedVar.committedRatioPct > 60) {
    out.push({
      id: 'committed-high',
      severity: 'warn',
      icon: 'scale',
      title: 'Spese fisse oltre il 60% del reddito',
      body: `Le tue spese incomprimibili (${eur(inputs.fixedVar.fixedMonthlyMinor)}/mese) assorbono il ${pct(inputs.fixedVar.committedRatioPct)} del reddito mediano: poco margine di manovra se le entrate calano. Sotto il 50% è la zona di comfort.`,
      impactMinor: inputs.fixedVar.fixedMonthlyMinor * 12,
      impactLabel: `${eur(inputs.fixedVar.fixedMonthlyMinor)}/mese fissi`,
    })
  }

  // ── warn: ritmo di spesa del mese sopra il tipico ───────────────────────────
  if (inputs.pacing.hasData && inputs.pacing.today >= 10 && inputs.pacing.today <= 27) {
    const overMinor = inputs.pacing.projectedEndMinor - inputs.pacing.typicalEndMinor
    if (overMinor >= 10000 && inputs.pacing.typicalEndMinor > 0
        && inputs.pacing.projectedEndMinor > inputs.pacing.typicalEndMinor * 1.15) {
      out.push({
        id: 'pacing-over',
        severity: 'warn',
        icon: 'calendar',
        title: 'Questo mese stai correndo',
        body: `Al giorno ${inputs.pacing.today} hai già speso ${eur(inputs.pacing.actualToDateMinor)} contro i ${eur(inputs.pacing.typicalToDateMinor)} tipici. Proiezione a fine mese: ${eur(inputs.pacing.projectedEndMinor)}, ${eur(overMinor)} sopra il tuo standard.`,
        impactMinor: overMinor * 12,
        impactLabel: `+${eur(overMinor)} previsti`,
      })
    }
  }

  // ── info: inflazione personale ──────────────────────────────────────────────
  if (inputs.inflation.hasData && inputs.inflation.overallPct !== null
      && inputs.inflation.overallPct >= 4) {
    const topMover = inputs.inflation.items[0]
    out.push({
      id: 'personal-inflation',
      severity: 'info',
      icon: 'coins',
      title: `La tua inflazione personale: ${pct(inputs.inflation.overallPct)}`,
      body: `Nei negozi dove compri abitualmente, lo scontrino mediano è salito del ${pct(inputs.inflation.overallPct)} rispetto a un anno fa${topMover ? ` (il peggiore: ${topMover.label}, ${pct(topMover.deltaPct)})` : ''}. A parità di abitudini sono circa ${eur(Math.round(annualExpenses * inputs.inflation.overallPct / 100))}/anno in più.`,
      impactMinor: Math.round(annualExpenses * inputs.inflation.overallPct / 100),
      impactLabel: `≈ ${eur(Math.round(annualExpenses * inputs.inflation.overallPct / 100))}/anno`,
    })
  }

  // ── opportunity: liquidità ferma e nessuna abitudine di investimento ────────
  if (inputs.excessCashMinor !== undefined && inputs.excessCashMinor >= 100000) {
    const investRates = completeCashflow.slice(-6)
      .map((c) => c.investmentRate)
      .filter((v): v is number => v !== null)
    if (investRates.length >= 3 && median(investRates) === 0) {
      out.push({
        id: 'invest-idle-cash',
        severity: 'opportunity',
        icon: 'piggy',
        title: 'Liquidità ferma oltre il buffer',
        body: `Hai ${eur(inputs.excessCashMinor)} oltre il fondo di emergenza e negli ultimi mesi non risultano trasferimenti abituali verso risparmio o investimenti. Vedi la sezione Smart DCA qui sotto per un'ipotesi di allocazione.`,
        impactMinor: inputs.excessCashMinor,
        impactLabel: `${eur(inputs.excessCashMinor)} fermi`,
      })
    }
  }

  // ── info: outlier recenti ───────────────────────────────────────────────────
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86_400_000).toISOString().slice(0, 10)
  for (const o of inputs.outliers.slice(0, 4)) {
    if (o.booked_date < thirtyDaysAgo || o.excessMinor < 10000) continue
    out.push({
      id: `outlier-recent:${o.id}`,
      severity: 'info',
      icon: 'alert',
      title: 'Spesa fuori scala recente',
      body: `${eur(Math.abs(o.amount_minor))} ${o.category_name ? `in ${o.category_name}` : ''} il ${new Date(o.booked_date + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}: ${eur(o.excessMinor)} sopra la tua mediana di categoria. Se era prevista, tutto ok — è solo fuori dal tuo pattern.`,
      impactMinor: o.excessMinor,
      impactLabel: `+${eur(o.excessMinor)} una tantum`,
    })
  }

  // ── info: confronto stagionale YoY ──────────────────────────────────────────
  if (inputs.yoy.hasData && inputs.yoy.deltaPct !== null && Math.abs(inputs.yoy.deltaPct) >= 15) {
    const up = inputs.yoy.deltaPct > 0
    out.push({
      id: 'yoy-shift',
      severity: 'info',
      icon: 'calendar',
      title: `${monthName(inputs.yoy.month)}: ${up ? 'più caro' : 'più leggero'} dell'anno scorso`,
      body: `A ${monthName(inputs.yoy.month)} hai speso ${eur(inputs.yoy.currentMinor)}, ${pct(Math.abs(inputs.yoy.deltaPct))} ${up ? 'in più' : 'in meno'} dello stesso mese del ${Number(inputs.yoy.month.slice(0, 4)) - 1} (${eur(inputs.yoy.lastYearMinor)}). Il confronto con lo stesso mese elimina l'effetto stagionalità.`,
      impactMinor: Math.abs(inputs.yoy.currentMinor - inputs.yoy.lastYearMinor),
    })
  }

  // ── info: concentrazione reddito ────────────────────────────────────────────
  if (inputs.income.hasData && inputs.income.topSourceSharePct !== null
      && inputs.income.topSourceSharePct >= 90 && inputs.income.sourceCount >= 1) {
    out.push({
      id: 'income-concentration',
      severity: 'info',
      icon: 'trend',
      title: 'Reddito concentrato su una sola fonte',
      body: `Il ${pct(inputs.income.topSourceSharePct)} delle tue entrate arriva da un'unica fonte${inputs.income.salaryLabel ? ` (${inputs.income.salaryLabel})` : ''}. Non è un problema oggi, ma è il motivo per cui il fondo di emergenza conta.`,
      impactMinor: 0,
    })
  }

  // ── warn: qualità dei dati — segno in contraddizione con la categoria ───────
  if (inputs.miscategorized.hasData) {
    const m = inputs.miscategorized
    const parts: string[] = []
    if (m.expenseCount >= 3 && m.expenseTotalMinor >= 10000) {
      parts.push(`${m.expenseCount} uscite per ${eur(m.expenseTotalMinor)} hanno una categoria di tipo entrata`)
    }
    if (m.incomeCount >= 3 && m.incomeTotalMinor >= 10000) {
      parts.push(`${m.incomeCount} entrate per ${eur(m.incomeTotalMinor)} hanno una categoria di tipo spesa`)
    }
    out.push({
      id: 'miscategorized-flows',
      severity: 'warn',
      icon: 'alert',
      title: 'Categorie in contraddizione con il segno',
      body: `${parts.join(' e ')}: spesso sono bonifici verso conti propri non collegati, marcati male. Finché restano così, gonfiano le statistiche di spesa — ricategorizzali (es. come Trasferimento).`,
      impactMinor: m.expenseTotalMinor + m.incomeTotalMinor,
    })
  }

  // ── info: igiene dei trasferimenti ──────────────────────────────────────────
  if (inputs.pairCount >= 3) {
    out.push({
      id: 'transfer-hygiene',
      severity: 'info',
      icon: 'repeat',
      title: `${inputs.pairCount} trasferimenti interni riconosciuti automaticamente`,
      body: `Ho individuato ${inputs.pairCount} coppie di movimenti speculari tra i tuoi conti e le ho escluse dalle statistiche. Per renderlo esplicito (e a prova di errore), assegna loro la categoria Trasferimento.`,
      impactMinor: 0,
    })
  }

  // ── info: valute miste ──────────────────────────────────────────────────────
  if (inputs.hasMultipleCurrencies) {
    out.push({
      id: 'multi-currency',
      severity: 'info',
      icon: 'coins',
      title: 'Valute miste nelle transazioni',
      body: 'Le statistiche sulle transazioni sommano gli importi nella valuta originale, senza conversione. Solo il patrimonio netto è convertito in EUR ai tassi BCE.',
      impactMinor: 0,
    })
  }

  out.sort((a, b) =>
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    || b.impactMinor - a.impactMinor,
  )
  return out.slice(0, MAX_INSIGHTS)
}
