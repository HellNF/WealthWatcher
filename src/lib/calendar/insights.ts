// src/lib/calendar/insights.ts — Il layer "wow" dello scadenziario.
//
// Non elenca scadenze: le legge insieme e ne estrae ciò che l'utente non vede da
// solo — il punto di minimo della cassa e la sua causa, i giorni ad alta
// concentrazione di uscite, gli abbonamenti aumentati di prezzo, il costo fiscale
// di fine anno contro la liquidità proiettata, le opportunità con countdown al
// 31/12, gli obiettivi a rischio. Ogni insight ha una soglia di materialità: sotto
// soglia, silenzio (stessa filosofia di src/lib/insights.ts).
import type { Insight, InsightSeverity } from '@/lib/insights'
import type { RecurringItem, DaySpendingPoint } from '@/lib/analytics'
import type { HarvestingRecommendation } from '@/lib/tax/harvesting'
import type { CashProjectionPoint, DeadlineEvent, ScadenziarioSummary } from './types'

const DAY_MS = 86_400_000

function eur(minor: number, decimals = 0): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  })
}
function pct(n: number, decimals = 1): string {
  return n.toLocaleString('it-IT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + '%'
}
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS)
}
const MONTH_NAMES = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
]
function fmtDayMonth(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${parseInt(d, 10)} ${MONTH_NAMES[parseInt(m, 10) - 1]}`
}

const SEVERITY_ORDER: Record<InsightSeverity, number> = { critical: 0, warn: 1, opportunity: 2, info: 3 }

export interface ScadenziarioInsightInputs {
  today:                   string
  events:                  DeadlineEvent[]
  projection:              CashProjectionPoint[]
  summary:                 ScadenziarioSummary
  recurring:               RecurringItem[]
  daySpending:             DaySpendingPoint[]
  wealthTaxYearTotalMinor: number
  harvesting:              HarvestingRecommendation[]
}

/** Genera le considerazioni dello scadenziario, ordinate per severità + impatto. */
export function computeScadenziarioInsights(inp: ScadenziarioInsightInputs): Insight[] {
  const out: Insight[] = []
  const { today, events, projection, summary } = inp

  // ── A. Punto di minimo della proiezione di cassa ──────────────────────────────
  if (projection.length > 1) {
    const min = summary.minBalanceMinor
    const minDate = summary.minBalanceDate
    // Trova la causa: l'uscita lumpy più grande nel giorno del minimo (o vicino)
    const nearMin = projection.find(p => p.date === minDate)
    const cause = nearMin?.events
      .filter(e => e.direction === 'out')
      .sort((a, b) => b.amountMinor - a.amountMinor)[0]
    const causeTxt = cause ? ` La causa principale: ${cause.label.toLowerCase()} (${eur(cause.amountMinor)}).` : ''

    if (min < 0) {
      out.push({
        id: 'projection-min', severity: 'critical', icon: 'alert',
        title: 'La liquidità proiettata va sotto zero',
        body: `Intorno al ${fmtDayMonth(minDate)} il saldo stimato tocca ${eur(min)}.${causeTxt} Anticipa entrate o posticipa uscite per evitare lo scoperto.`,
        impactMinor: Math.abs(min), impactLabel: `minimo ${eur(min)}`,
      })
    } else if (min < summary.cashStartMinor) {
      const drop = summary.cashStartMinor - min
      // Materialità: mostra solo se il calo è ≥ €200 e ≥ 10% della cassa iniziale
      if (drop >= 20_000 && (summary.cashStartMinor <= 0 || drop / summary.cashStartMinor >= 0.10)) {
        out.push({
          id: 'projection-min', severity: summary.status === 'WARNING' ? 'warn' : 'info', icon: 'trend',
          title: `Il saldo tocca il minimo il ${fmtDayMonth(minDate)}`,
          body: `Nei prossimi ${summary.horizonDays} giorni la liquidità scende fino a ${eur(min)} (${eur(drop)} sotto il livello di oggi).${causeTxt}`,
          impactMinor: drop, impactLabel: `−${eur(drop)}`,
        })
      }
    }
  }

  // ── B. Giorno ad alta concentrazione di uscite ────────────────────────────────
  {
    const outByDate = new Map<string, { total: number; labels: string[] }>()
    for (const e of events) {
      if (e.kind !== 'cash' || e.direction !== 'out') continue
      if (e.date < today) continue
      const g = outByDate.get(e.date) ?? { total: 0, labels: [] }
      g.total += e.amountMinor
      g.labels.push(e.label)
      outByDate.set(e.date, g)
    }
    let peak: { date: string; total: number; labels: string[] } | null = null
    for (const [date, g] of outByDate) {
      if (g.labels.length >= 2 && (peak === null || g.total > peak.total)) {
        peak = { date, total: g.total, labels: g.labels }
      }
    }
    // Confronto con la spesa giornaliera tipica
    const typicalDays = inp.daySpending.map(d => d.avgMinor).filter(v => v > 0).sort((a, b) => a - b)
    const typicalDaily = typicalDays.length > 0 ? typicalDays[Math.floor(typicalDays.length / 2)] : 0
    if (peak && peak.total >= 50_000 && (typicalDaily === 0 || peak.total >= typicalDaily * 4)) {
      out.push({
        id: 'concentration', severity: 'warn', icon: 'calendar',
        title: `${fmtDayMonth(peak.date)}: giornata pesante`,
        body: `In un solo giorno si concentrano ${eur(peak.total)} tra ${peak.labels.length} scadenze (${peak.labels.slice(0, 3).join(', ').toLowerCase()}). Assicurati che la liquidità sia pronta.`,
        impactMinor: peak.total, impactLabel: eur(peak.total),
      })
    }
  }

  // ── C. Abbonamenti aumentati di prezzo ────────────────────────────────────────
  for (const r of inp.recurring) {
    if (r.status !== 'active' || r.priceChangePct === null || r.priceChangePct <= 0) continue
    if (r.oldAmountMinor === null) continue
    const yearlyDelta = (r.amountMinor - r.oldAmountMinor) * (r.yearlyMinor / Math.max(1, r.amountMinor))
    if (yearlyDelta < 1_500) continue  // < €15/anno: sotto soglia
    out.push({
      id: `price-increase:${r.key}`, severity: 'opportunity', icon: 'repeat',
      title: `${r.description} è aumentato del ${pct(r.priceChangePct)}`,
      body: `Il canone ${r.cadenceLabel ?? ''} è passato da ${eur(r.oldAmountMinor)} a ${eur(r.amountMinor)}. Sull'anno sono ${eur(Math.round(yearlyDelta))} in più: valuta se rinegoziare o disdire.`,
      impactMinor: Math.round(yearlyDelta), impactLabel: `+${eur(Math.round(yearlyDelta))}/anno`,
    })
  }

  // ── C-bis. Costo totale degli abbonamenti ricorrenti ──────────────────────────
  {
    const subs = inp.recurring.filter(r => r.status === 'active' && r.cadence !== null && r.kind === 'subscription')
    const yearly = subs.reduce((s, r) => s + r.yearlyMinor, 0)
    if (subs.length >= 3 && yearly >= 30_000) {
      out.push({
        id: 'subscriptions-total', severity: 'info', icon: 'coins',
        title: `${subs.length} abbonamenti attivi`,
        body: `I tuoi abbonamenti ricorrenti valgono ${eur(yearly)} l'anno (${eur(Math.round(yearly / 12))} al mese). Una revisione periodica ripaga.`,
        impactMinor: yearly, impactLabel: `${eur(yearly)}/anno`,
      })
    }
  }

  // ── D. Costo fiscale di fine anno vs liquidità proiettata al 31/12 ─────────────
  if (inp.wealthTaxYearTotalMinor > 0) {
    const yearEnd = `${today.slice(0, 4)}-12-31`
    const projPoint = projection.find(p => p.date === yearEnd)
    if (projPoint) {
      const margin = projPoint.balanceMinor - inp.wealthTaxYearTotalMinor
      const severity: InsightSeverity = margin < 0 ? 'warn' : 'info'
      out.push({
        id: 'yearend-tax', severity, icon: 'scale',
        title: 'Imposte patrimoniali di fine anno',
        body: margin < 0
          ? `Bollo e IVAFE pesano ${eur(inp.wealthTaxYearTotalMinor)} entro il 31/12, ma la liquidità proiettata a quella data è ${eur(projPoint.balanceMinor)}: mancano ${eur(Math.abs(margin))}. Meglio accantonare per tempo.`
          : `Bollo e IVAFE pesano ${eur(inp.wealthTaxYearTotalMinor)} entro il 31/12. La liquidità proiettata a quella data (${eur(projPoint.balanceMinor)}) copre la spesa con un margine di ${eur(margin)}.`,
        impactMinor: inp.wealthTaxYearTotalMinor, impactLabel: eur(inp.wealthTaxYearTotalMinor),
      })
    }
  }

  // ── E. Opportunità tax-loss harvesting con countdown ──────────────────────────
  {
    const extend = inp.harvesting.filter(h => h.type === 'EXTEND_EXPIRY')
    const benefit = extend.reduce((s, h) => s + h.taxImpactMinor, 0)
    if (benefit >= 1_000) {
      const yearEnd = `${today.slice(0, 4)}-12-31`
      const days = Math.max(0, daysBetween(today, yearEnd))
      out.push({
        id: 'harvesting', severity: 'opportunity', icon: 'piggy',
        title: `${eur(benefit)} di crediti fiscali da salvare`,
        body: `Ti restano ${days} giorni (fino al 31/12) per realizzare plusvalenze e assorbire i crediti in scadenza, evitando di perderli.`,
        impactMinor: benefit, impactLabel: eur(benefit), href: '/dashboard/tasse',
      })
    }
  }

  // ── F. Obiettivo a rischio ────────────────────────────────────────────────────
  for (const e of events) {
    if (e.source !== 'obiettivo' || !(e.meta?.atRisk)) continue
    out.push({
      id: `goal-risk:${e.meta?.goalId}`, severity: 'warn', icon: 'piggy',
      title: `Obiettivo a rischio: ${e.label.replace(/^Scadenza obiettivo — /, '')}`,
      body: `${e.suggestion ?? 'Al ritmo attuale la data target non verrà rispettata.'} Mancano ${eur(e.amountMinor)} entro il ${fmtDayMonth(e.date)}.`,
      impactMinor: e.amountMinor, impactLabel: eur(e.amountMinor), href: e.href,
    })
  }

  // ── G. Prossima grande uscita singola ─────────────────────────────────────────
  {
    const bigOut = events
      .filter(e => e.kind === 'cash' && e.direction === 'out' && e.date >= today)
      .sort((a, b) => (a.date === b.date ? b.amountMinor - a.amountMinor : a.date.localeCompare(b.date)))
      .filter(e => e.amountMinor >= 50_000)[0]
    if (bigOut) {
      const days = Math.max(0, daysBetween(today, bigOut.date))
      // Evita duplicato se coincide col picco di concentrazione già segnalato
      if (!out.some(i => i.id === 'concentration')) {
        out.push({
          id: 'next-big-outflow', severity: 'info', icon: 'trend',
          title: `Prossima grande uscita tra ${days} giorni`,
          body: `${bigOut.label} di ${eur(bigOut.amountMinor)} il ${fmtDayMonth(bigOut.date)}.`,
          impactMinor: bigOut.amountMinor, impactLabel: eur(bigOut.amountMinor),
        })
      }
    }
  }

  out.sort((a, b) =>
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.impactMinor - a.impactMinor,
  )
  return out.slice(0, 8)
}
