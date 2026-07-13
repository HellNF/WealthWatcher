import { requireUser } from '@/lib/dal'
import {
  netWorthStats,
  transactionStats,
  fireStats,
  runwayStats,
  cashDragStats,
  lifestyleCreepStats,
  spendingCycleByDay,
  portfolioMWRR,
  recurringWithOpportunityCost,
  wealthEffectStats,
  affinityStats,
  decumuloStats,
  cashflowVariabilityStats,
  dcaCounterfactualStats,
  cashflowForecastStats,
  dcaRecommendationStats,
} from '@/lib/analytics'
import { estimatedWealthTaxes } from '@/lib/tax/wealth'
import {
  monthBridge,
  fixedVariableSplit,
  personalInflation,
  incomeProfile,
  monthPacing,
  merchantConcentration,
  miscategorizedFlows,
  sameMonthYoY,
} from '@/lib/spendingInsights'
import { computeInsights, type InsightIcon, type InsightSeverity } from '@/lib/insights'
import {
  TrendingUp, BarChart2, Target, ShieldCheck,
  Repeat2, Zap, Calendar, AlertCircle, Rocket,
  Activity, Link2, Clock, Gauge, Shuffle,
  ArrowRight, Wallet, Lightbulb, PiggyBank, Scale, Coins,
} from 'lucide-react'
import { Breadcrumb, Card, Stat, Badge, EmptyState } from '@/components/ui'
import Link from 'next/link'
import AllocationOverTime   from './AllocationOverTime'
import CashflowChart        from './CashflowChart'
import WeekdayChart         from './WeekdayChart'
import DayOfMonthChart      from './DayOfMonthChart'
import LifestyleCreepChart  from './LifestyleCreepChart'
import MonthBridgeChart     from './MonthBridgeChart'
import PacingChart          from './PacingChart'
import FixedVariableChart   from './FixedVariableChart'

export const dynamic = 'force-dynamic'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  })
}
function fmtPct(n: number | null, dec = 1): string {
  if (n === null) return '—'
  if (!isFinite(n) || isNaN(n)) return '0,0%'
  return n.toLocaleString('it-IT', {
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  }) + '%'
}
function sign(n: number): string { return n >= 0 ? '+' : '' }
function pctColor(n: number | null) {
  if (n === null) return 'text-[--muted]'
  return n >= 0 ? 'text-[--brand-text]' : 'text-[--danger]'
}
function clamp(n: number, lo: number, hi: number) { return Math.min(Math.max(n, lo), hi) }

function fmtYears(years: number | null): string {
  if (years === null) return 'Sostenibile'
  const y = Math.floor(years)
  const m = Math.round((years - y) * 12)
  if (y === 0) return `${m} ${m === 1 ? 'mese' : 'mesi'}`
  if (m === 0) return `${y} anni`
  return `${y}a ${m}m`
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2.5 bg-[--surface-2] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${clamp(pct, 0, 100)}%`, background: color }}
      />
    </div>
  )
}

function ClusterHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[--brand-subtle]">
        <Icon className="size-4 text-[--brand-text]" strokeWidth={1.75} />
      </div>
      <h2 className="text-base font-semibold text-[--ink]">{title}</h2>
    </div>
  )
}

// ── Considerazioni ────────────────────────────────────────────────────────────

const INSIGHT_ICONS: Record<InsightIcon, React.ElementType> = {
  trend: TrendingUp, repeat: Repeat2, alert: AlertCircle,
  piggy: PiggyBank, calendar: Calendar, scale: Scale, coins: Coins,
}

const SEVERITY_META: Record<InsightSeverity, {
  rail: string
  badge: 'danger' | 'warning' | 'gain' | 'neutral'
  label: string
}> = {
  critical:    { rail: 'var(--danger)',        badge: 'danger',  label: 'Critico'     },
  warn:        { rail: '#f59e0b',              badge: 'warning', label: 'Attenzione'  },
  opportunity: { rail: 'var(--brand)',         badge: 'gain',    label: 'Opportunità' },
  info:        { rail: 'oklch(0.55 0.01 160)', badge: 'neutral', label: 'Info'        },
}

function monthLabelIt(yyyyMm: string): string {
  const names = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
  return `${names[Number(yyyyMm.slice(5, 7)) - 1] ?? yyyyMm} ${yyyyMm.slice(0, 4)}`
}

// ── Pagina ────────────────────────────────────────────────────────────────────

export default async function StatistichePage() {
  const user    = await requireUser()
  const nwStats = netWorthStats(user.id)
  const txStats = transactionStats(user.id)
  const ctx     = txStats.ctx

  // Dati derivati dal patrimonio
  const latest         = nwStats.allocationTimeSeries.at(-1)
  const investMinor    = latest?.investments  ?? 0
  const liquidityMinor = latest?.accounts     ?? 0
  const totalNWMinor   = latest ? (latest.investments + latest.accounts + latest.otherAssets) : 0
  const hasSnapshots   = nwStats.allocationTimeSeries.length >= 2

  // CAGR: prefer 1 anno, poi tutto
  const cagrPeriod = nwStats.growth.find((g) => g.label === '1 anno' && g.cagrPct !== null)
                  ?? nwStats.growth.find((g) => g.label === 'Tutto'  && g.cagrPct !== null)
  const cagrPct    = cagrPeriod?.cagrPct ?? null

  // Pianificazione
  const fire     = fireStats(ctx, investMinor, cagrPct)
  const runway   = runwayStats(ctx, liquidityMinor)
  const cashDrag = cashDragStats(ctx, nwStats.allocationTimeSeries, cagrPct)
  const decumulo = decumuloStats(ctx, totalNWMinor, nwStats.volatility.maxDrawdownPct, cagrPct)

  // Transazioni avanzate
  const creep         = lifestyleCreepStats(ctx)
  const daySpending   = spendingCycleByDay(ctx)
  const mwrr          = portfolioMWRR(user.id)
  const recurringCost = recurringWithOpportunityCost(txStats.recurring, cagrPct)
  const wealthEffect  = wealthEffectStats(nwStats.allocationTimeSeries, txStats.cashflow)
  const affinity      = affinityStats(user.id)
  const cfVariability = cashflowVariabilityStats(txStats.cashflow)
  const dca           = dcaCounterfactualStats(user.id)
  const currentYear   = new Date().getFullYear().toString()
  const wealthTaxes   = await estimatedWealthTaxes(user.id, currentYear).catch(() => null)
  const forecast      = cashflowForecastStats(
    txStats.cashflow, txStats.recurring, liquidityMinor,
    wealthTaxes?.totalMinor ?? 0,
  )
  const dcaRec        = dcaRecommendationStats(user.id, liquidityMinor, txStats.cashflow)

  // Metriche contabili avanzate (fase Considerazioni)
  const bridge        = monthBridge(txStats.expenses)
  const fixedVar      = fixedVariableSplit(txStats.expenses, txStats.recurring, txStats.cashflow)
  const inflation     = personalInflation(txStats.expenses)
  const income        = incomeProfile(txStats.incomes)
  const pacing        = monthPacing(txStats.expenses)
  const concentration = merchantConcentration(txStats.expenses)
  const yoy           = sameMonthYoY(txStats.expenses)
  const miscategorized = miscategorizedFlows(txStats.expenses, txStats.incomes)

  const insights = computeInsights({
    cashflow:  txStats.cashflow,
    recurring: txStats.recurring,
    outliers:  txStats.outliers,
    bridge, fixedVar, inflation, income, pacing, concentration, yoy, miscategorized,
    forecast,
    pairCount: ctx.pairCount,
    hasMultipleCurrencies: ctx.hasMultipleCurrencies,
    excessCashMinor: dcaRec.hasData ? dcaRec.excessCashMinor : undefined,
  })

  // Flag sezioni
  const hasCashflow  = txStats.cashflow.length >= 2
  const hasRecurring = recurringCost.length > 0
  const hasOutliers  = txStats.outliers.length > 0
  const hasMWRR      = mwrr.length > 0
  const hasDCA       = dca.hasData
  const hasInvSection = hasMWRR || dca.hasBuyTxns

  // Savings rate aggregato ultimi 6 mesi: Σnetto / Σentrate (flusso reale).
  // La media delle percentuali mensili esploderebbe nei mesi a reddito ~zero.
  const recentCf = txStats.cashflow.slice(-6)
  const sumInflow  = recentCf.reduce((s, m) => s + m.inflow, 0)
  const sumOutflow = recentCf.reduce((s, m) => s + m.outflow, 0)
  const sumTransferNet = recentCf.reduce((s, m) => s + Math.max(0, m.transferOutMinor - m.transferInMinor), 0)
  const avgSavingsRate = sumInflow > 0
    ? ((sumInflow - sumOutflow) / sumInflow) * 100
    : null
  const avgInvestmentRate = sumInflow > 0
    ? (sumTransferNet / sumInflow) * 100
    : null

  // Colore FIRE progress
  const fireColor = fire.progressPct >= 100 ? 'var(--brand)'
    : fire.progressPct >= 50 ? '#f59e0b'
    : 'oklch(0.65 0.008 160)'

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-14">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Statistiche' },
      ]} />

      {/* ═══════════════════════════════════════════════════════════════════
          CLUSTER 0 — CONSIDERAZIONI (insight prioritizzati per impatto)
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <ClusterHeader icon={Lightbulb} title="Considerazioni" />
        {insights.length === 0 ? (
          <Card>
            <p className="text-sm text-[--muted]">
              Nessuna considerazione rilevante: le tue finanze sono in linea con il tuo storico.
              Le considerazioni compaiono solo quando c&apos;è qualcosa di materiale da dirti.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((ins) => {
              const meta = SEVERITY_META[ins.severity]
              const Icon = INSIGHT_ICONS[ins.icon]
              return (
                <Card key={ins.id} className="relative overflow-hidden">
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-1"
                    style={{ background: meta.rail }}
                  />
                  <div className="pl-2 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className="size-4 shrink-0 text-[--muted]" strokeWidth={1.75} />
                        <h3 className="text-sm font-semibold text-[--ink] truncate">{ins.title}</h3>
                      </div>
                      <Badge variant={meta.badge} className="shrink-0">{meta.label}</Badge>
                    </div>
                    <p className="text-sm text-[--muted] leading-relaxed">{ins.body}</p>
                    <div className="flex items-center justify-between gap-3 pt-1">
                      {ins.impactLabel ? (
                        <span className="text-xs font-medium font-mono tabular-nums text-[--ink] bg-[--surface-2] rounded-md px-2 py-1">
                          {ins.impactLabel}
                        </span>
                      ) : <span />}
                      {ins.href && (
                        <Link href={ins.href} className="text-xs text-[--brand-text] hover:underline shrink-0">
                          Approfondisci →
                        </Link>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          CLUSTER A — PERFORMANCE & VOLATILITÀ
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <ClusterHeader icon={TrendingUp} title="Performance & Volatilità" />
          {nwStats.hasStaleSnapshots && (
            <Badge variant="warning" className="ml-2">valori parziali</Badge>
          )}
        </div>

        {!hasSnapshots ? (
          <Card>
            <EmptyState
              icon={BarChart2}
              title="Nessun dato storico"
              description="Le statistiche patrimoniali si attivano dopo 2 snapshot giornalieri. La dashboard ne crea uno al giorno automaticamente."
            />
          </Card>
        ) : (
          <>
            {/* CAGR + variazione per periodo */}
            <Card className="space-y-5">
              <h3 className="text-sm font-semibold text-[--ink]">Crescita per periodo</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
                {nwStats.growth.map((g) => (
                  <div key={g.label} className="space-y-1">
                    <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">{g.label}</p>
                    {g.changeMinor === null ? (
                      <p className="text-sm text-[--faint]">—</p>
                    ) : (
                      <>
                        <p className={`text-lg font-semibold font-mono tabular-nums leading-none ${pctColor(g.changePct)}`}>
                          {g.changePct !== null ? sign(g.changePct) + fmtPct(g.changePct) : '—'}
                        </p>
                        <p className="text-xs text-[--muted] tabular-nums">
                          {sign(g.changeMinor)}{fmtEur(g.changeMinor)}
                        </p>
                        {g.cagrPct !== null && (
                          <p className="text-xs text-[--faint]">CAGR {sign(g.cagrPct)}{fmtPct(g.cagrPct)}/anno</p>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Volatilità e stabilità */}
            <Card className="space-y-5">
              <h3 className="text-sm font-semibold text-[--ink]">Volatilità e stabilità</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <Stat label="Mese migliore"
                  value={nwStats.volatility.bestMonthPct !== null
                    ? sign(nwStats.volatility.bestMonthPct) + fmtPct(nwStats.volatility.bestMonthPct)
                    : '—'}
                  size="sm" />
                <Stat label="Mese peggiore"
                  value={nwStats.volatility.worstMonthPct !== null ? fmtPct(nwStats.volatility.worstMonthPct) : '—'}
                  size="sm" />
                <Stat label="Max drawdown"
                  value={nwStats.volatility.maxDrawdownPct !== null ? fmtPct(nwStats.volatility.maxDrawdownPct) : '—'}
                  sub="calo massimo dai massimi storici" size="sm" />
                <Stat label="Volatilità mensile"
                  value={nwStats.volatility.stdDevMonthlyPct !== null ? fmtPct(nwStats.volatility.stdDevMonthlyPct) + ' σ' : '—'}
                  sub="deviazione standard rendimenti" size="sm" />
              </div>
            </Card>

            {/* Composizione nel tempo */}
            <Card className="space-y-4">
              <h3 className="text-sm font-semibold text-[--ink]">Composizione del patrimonio nel tempo</h3>
              <AllocationOverTime data={nwStats.allocationTimeSeries} />
            </Card>
          </>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          CLUSTER B — PROIEZIONI FI/RE
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <ClusterHeader icon={Rocket} title="Proiezioni di Indipendenza (FI/RE)" />

        {/* FI/RE Tracker */}
        <Card className="space-y-5">
          <div className="flex items-center gap-2">
            <Target className="size-4 text-[--muted]" strokeWidth={1.75} />
            <h3 className="text-sm font-semibold text-[--ink]">FI/RE Tracker — Indipendenza finanziaria</h3>
            <span className="text-xs text-[--faint] ml-1">(regola del 4%)</span>
          </div>
          {!fire.hasData ? (
            <p className="text-sm text-[--faint]">Importa almeno 1 mese di movimenti per calcolare la proiezione.</p>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-xs text-[--muted] uppercase tracking-wide font-medium">Investimenti attuali</p>
                    <p className="text-3xl font-bold font-mono tabular-nums text-[--ink] mt-1 leading-none">
                      {fmtEur(fire.currentInvestmentsMinor)}
                    </p>
                    <p className="text-sm text-[--muted] mt-0.5">su {fmtEur(fire.fireNumberMinor)} obiettivo FI</p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="text-3xl font-bold font-mono tabular-nums" style={{ color: fireColor }}>
                      {fire.progressPct}%
                    </p>
                    {fire.estimatedFIYear && (
                      <p className="text-sm text-[--muted]">
                        ~{fire.estimatedFIYear}
                        {fire.yearsToFI !== null && fire.yearsToFI > 0 && (
                          <span className="text-[--faint] ml-1">({fire.yearsToFI} anni)</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                <ProgressBar pct={fire.progressPct} color={fireColor} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-2 border-t border-[--border]">
                <Stat label="Spesa annua" value={fmtEur(fire.annualExpensesMinor)} size="sm" />
                <Stat label="Risparmio netto/anno" value={fmtEur(fire.annualNetMinor)} size="sm" sub="ultimi 12 mesi" />
                <Stat label="CAGR portafoglio"
                  value={fire.portfolioCAGRPct !== null ? sign(fire.portfolioCAGRPct) + fmtPct(fire.portfolioCAGRPct) : '—'}
                  size="sm" />
                <Stat label="Obiettivo FI" value={fmtEur(fire.fireNumberMinor)} size="sm" sub="investimenti necessari" />
              </div>
            </>
          )}
        </Card>

        {/* Rimando alla pagina Tasse */}
        {wealthTaxes && wealthTaxes.totalMinor > 0 && (
          <Card className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium text-[--ink]">
                Imposte patrimoniali stimate {currentYear}:{' '}
                <span className="font-mono tabular-nums text-[--danger]">
                  {fmtEur(wealthTaxes.totalMinor)}
                </span>
              </p>
              <p className="text-xs text-[--muted] mt-0.5">Incluse nella proiezione cashflow qui sotto.</p>
            </div>
            <Link
              href="/dashboard/tasse"
              className="shrink-0 inline-flex items-center gap-1.5 text-xs text-[--brand-text] hover:underline"
            >
              Dettaglio bollo/IVAFE →
            </Link>
          </Card>
        )}

        {/* Cashflow Forecast */}
        {forecast.hasData && (
          <Card className="space-y-5">
            <div className="flex items-center gap-2">
              <ArrowRight className="size-4 text-[--muted]" strokeWidth={1.75} />
              <h3 className="text-sm font-semibold text-[--ink]">Proiezione cashflow — Prossimi 30/60 giorni</h3>
            </div>
            <p className="text-xs text-[--muted]">
              Stima basata sulla media degli ultimi {Math.min(txStats.cashflow.length, 3)} mesi di entrate/uscite reali
              (trasferimenti tra conti propri esclusi). Non tiene conto di eventi straordinari.
              {forecast.wealthTaxMonthlyMinor > 0 && (
                <> Incluse <strong className="text-[--ink]">{fmtEur(forecast.wealthTaxMonthlyMinor)}/mese</strong> di imposte patrimoniali stimate.</>
              )}
              {forecast.plannedTransfersMonthlyMinor > 0 && (
                <> Considerati <strong className="text-[--ink]">{fmtEur(forecast.plannedTransfersMonthlyMinor)}/mese</strong> di
                trasferimenti abituali verso risparmio/investimenti: non sono spesa, ma riducono la liquidità.</>
              )}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              <Stat label="Saldo liquido attuale" value={fmtEur(liquidityMinor)} size="sm" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">Tra 30 giorni</p>
                <p className={`text-lg font-semibold font-mono tabular-nums leading-none ${forecast.proj30Minor >= forecast.thresholdMinor ? 'text-[--ink]' : 'text-[--danger]'}`}>
                  {fmtEur(forecast.proj30Minor)}
                </p>
                {forecast.proj30Minor < forecast.thresholdMinor && (
                  <p className="text-xs text-[--danger]">sotto 1 mese di spese</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">Tra 60 giorni</p>
                <p className={`text-lg font-semibold font-mono tabular-nums leading-none ${forecast.proj60Minor >= forecast.thresholdMinor ? 'text-[--ink]' : 'text-[--danger]'}`}>
                  {fmtEur(forecast.proj60Minor)}
                </p>
                {forecast.proj60Minor < forecast.thresholdMinor && (
                  <p className="text-xs text-[--danger]">sotto 1 mese di spese</p>
                )}
              </div>
              <Stat
                label="Flusso netto/mese"
                value={(forecast.avgMonthlyNetMinor >= 0 ? '+' : '') + fmtEur(forecast.avgMonthlyNetMinor)}
                sub={forecast.avgMonthlyNetMinor < 0 ? 'spesa netta mensile' : 'risparmio netto mensile'}
                size="sm"
              />
            </div>
            {forecast.crossesThresholdInDays !== null && (
              <div className="flex items-center gap-2 rounded-lg bg-[--danger-subtle] px-3 py-2.5">
                <AlertCircle className="size-4 text-[--danger] shrink-0" strokeWidth={1.75} />
                <p className="text-xs text-[--danger-text]">
                  Al trend attuale il saldo liquido scende sotto 1 mese di spese entro{' '}
                  <strong>{forecast.crossesThresholdInDays} giorni</strong>.
                  Considera di ridurre le uscite o trasferire liquidità.
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Smart DCA */}
        {dcaRec.hasData && (
          <Card className="space-y-5">
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-[--muted]" strokeWidth={1.75} />
              <h3 className="text-sm font-semibold text-[--ink]">Smart DCA — Come investire la liquidità in eccesso</h3>
            </div>
            <p className="text-xs text-[--muted]">
              Hai <strong className="text-[--ink]">{fmtEur(dcaRec.excessCashMinor)}</strong> di liquidità
              al di sopra del buffer di emergenza ({fmtEur(dcaRec.emergencyBufferMinor)} · 3 mesi di spese).
              Per mantenere l&apos;attuale composizione del portafoglio senza vendere nulla, distribuiscila così:
            </p>
            <div className="divide-y divide-[--border]">
              {dcaRec.recommendations.map((r) => (
                <div key={r.instrumentId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-[--ink]">
                        <span className="font-mono">{r.symbol}</span>
                      </p>
                      <span className="text-xs text-[--muted] truncate hidden sm:block">{r.name}</span>
                      <span className="inline-flex items-center rounded-md bg-[--surface-2] px-1.5 py-0.5 text-xs text-[--muted]">
                        {r.cluster}
                      </span>
                    </div>
                    <p className="text-xs text-[--faint] mt-0.5">{r.pctOfPortfolio}% del portafoglio investito</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold font-mono tabular-nums text-[--brand-text]">{fmtEur(r.suggestedMinor)}</p>
                    <p className="text-xs text-[--faint]">{r.currency}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-[--faint] border-t border-[--border] pt-3">
              I suggerimenti sono proporzionali al costo storico investito in ogni strumento.
              Non costituiscono consulenza finanziaria.
            </p>
          </Card>
        )}

        {/* Stress Test Decumulo */}
        <Card className="space-y-5">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-[--muted]" strokeWidth={1.75} />
            <h3 className="text-sm font-semibold text-[--ink]">Stress Test decumulo — Speranza di vita del capitale</h3>
          </div>
          <p className="text-xs text-[--muted]">
            Simulazione di quanti anni il patrimonio attuale ({fmtEur(totalNWMinor)}) sostiene la spesa corrente:
            scenario normale (crescita al CAGR) e scenario stress (max drawdown storico applicato subito, poi crescita al CAGR).
          </p>
          {!decumulo.hasData ? (
            <p className="text-sm text-[--faint]">Importa almeno 6 mesi di movimenti e accumula snapshot per attivare questa analisi.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[--border] p-5 space-y-3">
                <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">Scenario normale</p>
                <p className="text-xs text-[--faint]">
                  Crescita al CAGR {cagrPct !== null ? fmtPct(cagrPct) : '—'}/anno · {fmtEur(decumulo.avgMonthlyExpensesMinor)}/mese di spesa
                </p>
                <p
                  className="text-3xl font-bold font-mono tabular-nums leading-none"
                  style={{ color: decumulo.normalSurvivalYears === null ? 'var(--brand)' : decumulo.normalSurvivalYears >= 30 ? 'var(--brand-text)' : decumulo.normalSurvivalYears >= 10 ? '#f59e0b' : 'var(--danger)' }}
                >
                  {fmtYears(decumulo.normalSurvivalYears)}
                </p>
                {decumulo.normalSurvivalYears === null && (
                  <p className="text-xs text-[--brand-text]">Il portafoglio cresce più di quanto si preleva</p>
                )}
              </div>
              <div className="rounded-xl border border-[--border] p-5 space-y-3">
                <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">
                  Scenario stress
                  {decumulo.maxDrawdownPct !== null && (
                    <span className="text-[--danger] ml-1">({fmtPct(decumulo.maxDrawdownPct)} drawdown)</span>
                  )}
                </p>
                <p className="text-xs text-[--faint]">
                  {decumulo.stressedNetWorthMinor !== null ? fmtEur(decumulo.stressedNetWorthMinor) : '—'} dopo drawdown · poi CAGR storico
                </p>
                {decumulo.maxDrawdownPct === null ? (
                  <p className="text-sm text-[--faint]">Nessun drawdown storico registrato ancora</p>
                ) : (
                  <p
                    className="text-3xl font-bold font-mono tabular-nums leading-none"
                    style={{ color: decumulo.stressedSurvivalYears === null ? 'var(--brand-text)' : decumulo.stressedSurvivalYears >= 20 ? '#f59e0b' : 'var(--danger)' }}
                  >
                    {fmtYears(decumulo.stressedSurvivalYears)}
                  </p>
                )}
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          CLUSTER C — RUNWAY INDEX & FONDO EMERGENZA
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <ClusterHeader icon={ShieldCheck} title="Runway Index & Fondo Emergenza" />

        {/* Runway — 3 scenari */}
        <Card className="space-y-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-[--muted]" strokeWidth={1.75} />
            <h3 className="text-sm font-semibold text-[--ink]">Autonomia finanziaria — 3 scenari di spesa</h3>
          </div>
          <p className="text-xs text-[--muted]">
            Quanti giorni dura la liquidità attuale ({fmtEur(runway.liquidityMinor)}) in tre scenari basati sugli ultimi 12 mesi.
          </p>
          {!runway.hasData ? (
            <p className="text-sm text-[--faint]">Importa movimenti per calcolare l&apos;autonomia finanziaria.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {runway.scenarios.map((s, i) => {
                const color = s.months >= 6 ? 'var(--brand)' : s.months >= 3 ? '#f59e0b' : 'var(--danger)'
                return (
                  <div key={i} className="rounded-xl border border-[--border] p-4 space-y-2">
                    <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">{s.label}</p>
                    <p className="text-2xl font-bold font-mono tabular-nums leading-none" style={{ color }}>
                      {s.days} gg
                    </p>
                    <p className="text-xs text-[--muted]">
                      ~{s.months} {s.months === 1 ? 'mese' : 'mesi'} · {fmtEur(s.monthlyMinor)}/mese
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Cash Drag */}
        {hasSnapshots && (
          <Card className="space-y-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-[--muted]" strokeWidth={1.75} />
              <h3 className="text-sm font-semibold text-[--ink]">Cash Drag — Costo opportunità della liquidità</h3>
            </div>
            <p className="text-xs text-[--muted]">
              Liquidità &ldquo;in eccesso&rdquo; rispetto a un fondo d&apos;emergenza di 3 mesi e quanto avrebbe
              reso se investita al CAGR del portafoglio nello stesso periodo.
            </p>
            {!cashDrag.hasData ? (
              <p className="text-sm text-[--faint]">
                {cashDrag.emergencyBufferMinor === 0
                  ? 'Importa movimenti per calcolare il fondo di emergenza consigliato.'
                  : 'La liquidità attuale è inferiore al buffer di emergenza consigliato: nessun cash drag.'}
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <Stat label="Buffer emergenza (3 mesi)" value={fmtEur(cashDrag.emergencyBufferMinor)} size="sm" />
                <Stat label="Liquidità media in eccesso" value={fmtEur(cashDrag.avgExcessLiquidityMinor)} size="sm" />
                <Stat label="Periodo analizzato" value={`${Math.round(cashDrag.periodYears * 10) / 10} anni`} size="sm" />
                <Stat label="Costo opportunità stimato"
                  value={cashDrag.opportunityCostMinor !== null ? fmtEur(cashDrag.opportunityCostMinor) : '—'}
                  sub={cagrPct !== null ? `al CAGR ${fmtPct(cagrPct)}/anno` : undefined}
                  size="sm" />
              </div>
            )}
          </Card>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          CLUSTER D — PATTERN COMPORTAMENTALI
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <ClusterHeader icon={Activity} title="Pattern Comportamentali" />

        {!hasCashflow && !hasRecurring && !hasOutliers ? (
          <Card>
            <EmptyState
              icon={BarChart2}
              title="Nessun dato sufficiente"
              description="Importa movimenti da almeno 2 mesi per sbloccare le statistiche avanzate."
            />
          </Card>
        ) : (
          <>
            {/* Cashflow mensile + savings rate + prevedibilità */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 space-y-4">
                <h3 className="text-sm font-semibold text-[--ink]">Cashflow mensile storico</h3>
                <CashflowChart data={txStats.cashflow} />
              </Card>
              <div className="flex flex-col gap-4">
                <Card className="space-y-4 flex-1">
                  <h3 className="text-sm font-semibold text-[--ink]">Tasso di risparmio</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Stat label="Risparmio su spese" value={avgSavingsRate !== null ? fmtPct(avgSavingsRate) : '—'} size="md" sub="media 6 mesi" />
                    <Stat label="Quota investita" value={avgInvestmentRate !== null ? fmtPct(avgInvestmentRate) : '—'} size="md" sub="trasferita a risparmio" />
                  </div>
                  {txStats.cashflow.length > 0 && (() => {
                    const last = txStats.cashflow.at(-1)!
                    return (
                      <div className="space-y-1 pt-2 border-t border-[--border]">
                        <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">Ultimo mese</p>
                        <p className={`text-sm font-medium tabular-nums ${pctColor(last.expenseSavingsRate)}`}>
                          {last.expenseSavingsRate !== null ? fmtPct(last.expenseSavingsRate) : '—'}
                        </p>
                        <p className="text-xs text-[--faint]">{last.month} · Netto {fmtEur(last.net)}</p>
                      </div>
                    )
                  })()}
                  <p className="text-xs text-[--faint]">Trasferimenti tra conti propri esclusi da entrate e uscite.</p>
                </Card>
                {cfVariability.hasData && (
                  <Card className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Gauge className="size-3.5 text-[--muted]" strokeWidth={1.75} />
                      <h3 className="text-xs font-semibold text-[--ink]">Prevedibilità cashflow</h3>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xl font-bold font-mono tabular-nums text-[--ink]">
                          {cfVariability.cv !== null ? cfVariability.cv.toFixed(2) : '—'}
                        </p>
                        <p className="text-xs text-[--faint] mt-0.5">CV = σ / |μ|</p>
                      </div>
                      <Badge variant={
                        cfVariability.verdict === 'stable'   ? 'gain'
                        : cfVariability.verdict === 'moderate' ? 'warning'
                        : 'loss'
                      }>
                        {cfVariability.verdict === 'stable'   && 'Stabile'}
                        {cfVariability.verdict === 'moderate' && 'Moderato'}
                        {cfVariability.verdict === 'chaotic'  && 'Caotico'}
                      </Badge>
                    </div>
                    <p className="text-xs text-[--muted]">
                      Buffer emergenza consigliato: <span className="font-medium text-[--ink]">{cfVariability.recommendedBufferMonths} mesi</span>
                    </p>
                  </Card>
                )}
              </div>
            </div>

            {/* Ponte del mese — variance analysis */}
            {bridge.hasData && (
              <Card className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Scale className="size-4 text-[--muted]" strokeWidth={1.75} />
                  <h3 className="text-sm font-semibold text-[--ink]">
                    Ponte del mese — {monthLabelIt(bridge.month)} vs mese tipico
                  </h3>
                  {bridge.isPartialMonth && <Badge variant="info">mese in corso</Badge>}
                </div>
                <p className="text-xs text-[--muted]">
                  Ogni barra è lo scostamento di una categoria dalla sua mediana degli ultimi{' '}
                  {bridge.monthsInBaseline} mesi completi: la risposta alla domanda
                  &ldquo;perché questo mese ho speso {bridge.totalDeltaMinor >= 0 ? 'di più' : 'di meno'}?&rdquo;.
                </p>
                <div className="grid grid-cols-3 gap-6">
                  <Stat label="Speso nel mese" value={fmtEur(bridge.totalActualMinor)} size="sm" />
                  <Stat label="Mese tipico" value={fmtEur(bridge.totalTypicalMinor)} size="sm" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">Scostamento</p>
                    <p className={`text-lg font-semibold font-mono tabular-nums leading-none ${bridge.totalDeltaMinor > 0 ? 'text-[--danger]' : 'text-[--brand-text]'}`}>
                      {sign(bridge.totalDeltaMinor)}{fmtEur(bridge.totalDeltaMinor)}
                    </p>
                  </div>
                </div>
                <MonthBridgeChart data={bridge} />
              </Card>
            )}

            {/* Pacing intra-mese */}
            {pacing.hasData && (
              <Card className="space-y-4">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-[--muted]" strokeWidth={1.75} />
                  <h3 className="text-sm font-semibold text-[--ink]">Ritmo del mese in corso</h3>
                </div>
                <p className="text-xs text-[--muted]">
                  Spesa cumulata di questo mese contro il tuo mese tipico (mediana degli ultimi{' '}
                  {pacing.monthsInBaseline} mesi completi) e proiezione a fine mese.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <Stat label={`Speso al giorno ${pacing.today}`} value={fmtEur(pacing.actualToDateMinor)} size="sm" />
                  <Stat label="Tipico a oggi" value={fmtEur(pacing.typicalToDateMinor)} size="sm" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">Proiezione fine mese</p>
                    <p className={`text-lg font-semibold font-mono tabular-nums leading-none ${pacing.projectedEndMinor > pacing.typicalEndMinor * 1.1 ? 'text-[--danger]' : 'text-[--ink]'}`}>
                      {fmtEur(pacing.projectedEndMinor)}
                    </p>
                  </div>
                  <Stat label="Tipico fine mese" value={fmtEur(pacing.typicalEndMinor)} size="sm" />
                </div>
                <PacingChart data={pacing} />
              </Card>
            )}

            {/* Fissi vs variabili + break-even */}
            {fixedVar.hasData && (
              <Card className="space-y-4">
                <div className="flex items-center gap-2">
                  <Gauge className="size-4 text-[--muted]" strokeWidth={1.75} />
                  <h3 className="text-sm font-semibold text-[--ink]">Spese fisse vs variabili — Punto di pareggio</h3>
                </div>
                <p className="text-xs text-[--muted]">
                  Le spese fisse (ricorrenti attivi + categorie vincolate come mutuo, utenze e tasse) sono il
                  tuo punto di pareggio: sotto quell&apos;entrata mensile il mese è strutturalmente in rosso.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <Stat label="Fisse / mese" value={fmtEur(fixedVar.fixedMonthlyMinor)} size="sm" sub="punto di pareggio" />
                  <Stat label="Variabili / mese" value={fmtEur(fixedVar.variableMonthlyMinor)} size="sm" sub="mediana 6 mesi" />
                  {fixedVar.medianIncomeMinor !== null && (
                    <Stat label="Reddito mediano" value={fmtEur(fixedVar.medianIncomeMinor)} size="sm" />
                  )}
                  {fixedVar.committedRatioPct !== null && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">Quota vincolata</p>
                      <p className={`text-lg font-semibold font-mono tabular-nums leading-none ${fixedVar.committedRatioPct > 60 ? 'text-[--danger]' : fixedVar.committedRatioPct > 50 ? 'text-[#f59e0b]' : 'text-[--brand-text]'}`}>
                        {fmtPct(fixedVar.committedRatioPct)}
                      </p>
                      <p className="text-xs text-[--faint]">del reddito mediano</p>
                    </div>
                  )}
                </div>
                <FixedVariableChart data={fixedVar.series} />
              </Card>
            )}

            {/* Ciclo mensile + weekday */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {daySpending.length > 0 && (
                <Card className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-[--muted]" strokeWidth={1.75} />
                    <h3 className="text-sm font-semibold text-[--ink]">Ciclo di spesa mensile</h3>
                  </div>
                  <p className="text-xs text-[--muted]">
                    Spesa media per giorno del mese (1–31). Barre rosse = picchi sopra il 75° percentile.
                    La linea viola mostra la media mobile esponenziale (trend).
                  </p>
                  <DayOfMonthChart data={daySpending} />
                </Card>
              )}
              {txStats.weekday.length > 0 && (
                <Card className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-[--muted]" strokeWidth={1.75} />
                    <h3 className="text-sm font-semibold text-[--ink]">Spesa per giorno della settimana</h3>
                  </div>
                  <p className="text-xs text-[--muted]">
                    Spesa totale per giorno della settimana (quota % e categoria dominante nel tooltip).
                  </p>
                  <WeekdayChart data={txStats.weekday} />
                </Card>
              )}
            </div>

            {/* Lifestyle Creep */}
            {creep.hasData && (
              <Card className="space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-sm font-semibold text-[--ink]">Lifestyle Creep — Inflazione dello stile di vita</h3>
                  {creep.verdict !== 'insufficient_data' && (
                    <Badge variant={creep.verdict === 'creep' ? 'warning' : creep.verdict === 'improving' ? 'gain' : 'neutral'}>
                      {creep.verdict === 'creep'     && 'Stile di vita in espansione'}
                      {creep.verdict === 'improving' && 'Risparmio in crescita'}
                      {creep.verdict === 'stable'    && 'Stabile'}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-[--muted]">
                  Correlazione tra la crescita delle entrate e delle uscite nel tempo.
                  Un indice di elasticità &gt; 1 indica che le spese crescono più velocemente del reddito.
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <LifestyleCreepChart data={creep.months} />
                  </div>
                  <div className="space-y-4 flex flex-col justify-center">
                    <Stat label="Elasticità spesa/reddito"
                      value={creep.elasticity !== null ? creep.elasticity.toFixed(2) + '×' : '—'}
                      size="sm" sub="1× = neutral, >1 = creep" />
                    {creep.incomeGrowthPct !== null && (
                      <Stat label="Trend entrate" value={sign(creep.incomeGrowthPct) + fmtPct(creep.incomeGrowthPct, 2)} size="sm" sub="per mese (media)" />
                    )}
                    {creep.spendGrowthPct !== null && (
                      <Stat label="Trend uscite" value={sign(creep.spendGrowthPct) + fmtPct(creep.spendGrowthPct, 2)} size="sm" sub="per mese (media)" />
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Trigger di spesa — Affinity Analysis */}
            {affinity.length > 0 && (
              <Card className="space-y-4">
                <div className="flex items-center gap-2">
                  <Link2 className="size-4 text-[--muted]" strokeWidth={1.75} />
                  <h3 className="text-sm font-semibold text-[--ink]">Trigger di spesa — Categorie correlate</h3>
                </div>
                <p className="text-xs text-[--muted]">
                  Coppie di categorie in cui una spesa in A è seguita entro 72 ore da una spesa in B con probabilità ≥ 20%.
                </p>
                <div className="divide-y divide-[--border]">
                  {affinity.map((pair, i) => (
                    <div key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                            style={{ background: pair.catA.color ?? 'var(--surface-2)', color: 'var(--ink)' }}
                          >
                            {pair.catA.name}
                          </span>
                          <span className="text-xs text-[--faint]">→</span>
                          <span
                            className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                            style={{ background: pair.catB.color ?? 'var(--surface-2)', color: 'var(--ink)' }}
                          >
                            {pair.catB.name}
                          </span>
                        </div>
                        <p className="text-xs text-[--faint] mt-1">
                          {pair.coOccurrences} co-occorrenze · spesa media in {pair.catB.name}: {fmtEur(pair.avgBSpendMinor)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className="text-lg font-bold font-mono tabular-nums"
                          style={{ color: pair.probability >= 0.5 ? 'var(--danger)' : pair.probability >= 0.3 ? '#f59e0b' : 'var(--muted)' }}
                        >
                          {Math.round(pair.probability * 100)}%
                        </p>
                        <p className="text-xs text-[--faint]">P(B|A)</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Effetto Ricchezza */}
            {wealthEffect.hasData && (
              <Card className="space-y-5">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-[--muted]" strokeWidth={1.75} />
                  <h3 className="text-sm font-semibold text-[--ink]">Effetto Ricchezza — Correlazione patrimonio↔spesa</h3>
                </div>
                <p className="text-xs text-[--muted]">
                  Pearson r tra la variazione mensile del patrimonio e la variazione della spesa del mese successivo.
                  Positivo = quando il patrimonio sale, tendi a spendere di più il mese dopo.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">Correlazione r</p>
                    <p
                      className="text-3xl font-bold font-mono tabular-nums leading-none"
                      style={{
                        color: wealthEffect.correlation === null ? 'var(--muted)'
                          : Math.abs(wealthEffect.correlation) > 0.5 ? (wealthEffect.correlation > 0 ? 'var(--danger)' : 'var(--brand-text)')
                          : 'var(--ink)',
                      }}
                    >
                      {wealthEffect.correlation !== null ? (wealthEffect.correlation >= 0 ? '+' : '') + wealthEffect.correlation.toFixed(3) : '—'}
                    </p>
                    <p className="text-xs text-[--faint]">−1 a +1</p>
                  </div>
                  <Stat label="Verdetto"
                    value={
                      wealthEffect.verdict === 'positive'  ? 'Effetto positivo'
                      : wealthEffect.verdict === 'negative' ? 'Effetto negativo'
                      : 'Neutro'
                    }
                    sub={
                      wealthEffect.verdict === 'positive'  ? 'spendi di più dopo mesi positivi'
                      : wealthEffect.verdict === 'negative' ? 'spendi meno dopo mesi positivi'
                      : 'nessuna correlazione significativa'
                    }
                    size="sm" />
                  <Stat label="Mesi analizzati" value={String(wealthEffect.monthsAnalyzed)} size="sm" />
                </div>
              </Card>
            )}

            {/* Pagamenti ricorrenti */}
            {hasRecurring && (() => {
              const subsAndBills = recurringCost.filter((r) => r.kind !== 'habit')
              const habits       = recurringCost.filter((r) => r.kind === 'habit')
              const activeSubs   = subsAndBills.filter((r) => r.status === 'active')
              const fmtShortDate = (iso: string) =>
                new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
              return (
              <Card className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Repeat2 className="size-4 text-[--muted]" strokeWidth={1.75} />
                    <h3 className="text-sm font-semibold text-[--ink]">Abbonamenti e pagamenti ricorrenti</h3>
                  </div>
                  <div className="text-xs text-[--faint] text-right space-y-0.5">
                    <p>Totale attivi/anno: <span className="font-medium text-[--ink]">{fmtEur(activeSubs.reduce((s, r) => s + r.yearlyMinor, 0))}</span></p>
                    {cagrPct !== null && (
                      <p>Costo opp. 5 anni: <span className="font-medium text-[--danger]">{fmtEur(activeSubs.reduce((s, r) => s + (r.yearly5yMinor ?? 0), 0))}</span></p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-[--muted]">
                  Cadenza dedotta dagli intervalli reali tra gli addebiti (l&apos;annualizzazione usa il fattore corretto:
                  settimanale ×52, mensile ×12, annuale ×1). La colonna &ldquo;5 anni investiti&rdquo; capitalizza
                  quei fondi al CAGR del portafoglio{cagrPct !== null ? ` (${fmtPct(cagrPct)}/anno)` : ''}.
                </p>
                {subsAndBills.length > 0 && (
                  <div className="divide-y divide-[--border]">
                    {subsAndBills.map((r, i) => (
                      <div key={r.key} className={`flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 ${r.status === 'ceased' ? 'opacity-55' : ''}`}>
                        <span className="text-xs tabular-nums text-[--faint] w-5 shrink-0 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm text-[--ink] truncate font-medium">{r.merchant_name ?? r.description}</p>
                            {r.cadenceLabel && <Badge variant="neutral">{r.cadenceLabel}</Badge>}
                            {r.priceChangePct !== null && r.oldAmountMinor !== null && (
                              <Badge variant={r.priceChangePct > 0 ? 'warning' : 'gain'}>
                                {r.priceChangePct > 0 ? '▲' : '▼'} {sign(r.priceChangePct)}{fmtPct(r.priceChangePct)} da {fmtEur(r.oldAmountMinor)}
                              </Badge>
                            )}
                            {r.status === 'ceased' && <Badge variant="neutral">cessato</Badge>}
                          </div>
                          <p className="text-xs text-[--faint] mt-0.5">
                            {r.occurrences} addebiti in {r.months} mesi
                            {r.status === 'ceased'
                              ? ` · risparmio ${fmtEur(r.yearlyMinor)}/anno`
                              : r.nextExpectedDate ? ` · prossimo ~${fmtShortDate(r.nextExpectedDate)}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0 space-y-0.5">
                          <p className="text-sm font-medium tabular-nums text-[--ink]">
                            {fmtEur(r.amountMinor)}
                            <span className="text-[--faint] font-normal">
                              {r.cadence === 'monthly' ? '/mese' : r.cadenceLabel ? ` ${r.cadenceLabel}` : ''}
                            </span>
                          </p>
                          {r.status === 'active' && r.yearly5yMinor !== null && (
                            <p className="text-xs text-[--danger] tabular-nums">{fmtEur(r.yearly5yMinor)} in 5a</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {habits.length > 0 && (
                  <div className="space-y-2 pt-3 border-t border-[--border]">
                    <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">Spesa abituale</p>
                    <p className="text-xs text-[--faint]">
                      Esercenti frequenti senza cadenza fissa (es. supermercato): mostrata la spesa mensile effettiva, non un canone.
                    </p>
                    <div className="divide-y divide-[--border]">
                      {habits.map((r) => (
                        <div key={r.key} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[--ink] truncate">{r.merchant_name ?? r.description}</p>
                            <p className="text-xs text-[--faint]">{r.occurrences} acquisti in {r.months} mesi</p>
                          </div>
                          <p className="text-sm font-medium tabular-nums text-[--ink] shrink-0">
                            {fmtEur(r.monthlyEquivalentMinor)}<span className="text-[--faint] font-normal">/mese</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
              )
            })()}

            {/* Outlier */}
            {hasOutliers && (
              <Card className="space-y-4">
                <div className="flex items-center gap-2">
                  <Zap className="size-4 text-[--muted]" strokeWidth={1.75} />
                  <h3 className="text-sm font-semibold text-[--ink]">Spese fuori scala</h3>
                </div>
                <p className="text-xs text-[--muted]">
                  Transazioni degli ultimi 6 mesi con z-score robusto ≥ 3,5 rispetto alla mediana
                  della propria categoria (baseline: 12 mesi). Gli addebiti di abbonamenti attivi non contano.
                </p>
                <div className="divide-y divide-[--border]">
                  {txStats.outliers.map((o) => (
                    <div key={o.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <AlertCircle className="size-4 text-[--muted] shrink-0" strokeWidth={1.75} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[--ink] truncate">
                          {o.description.length > 50 ? o.description.slice(0, 50) + '…' : o.description}
                        </p>
                        <p className="text-xs text-[--faint]">
                          {o.booked_date}{o.category_name ? ` · ${o.category_name}` : ''} · mediana {fmtEur(o.categoryMedianMinor)} · z {o.robustZ.toLocaleString('it-IT')}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium tabular-nums text-[--danger]">{fmtEur(Math.abs(o.amount_minor))}</p>
                        <p className="text-xs text-[--faint]">+{fmtEur(o.excessMinor)} vs mediana</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Investimenti */}
            {hasInvSection && (
              <>
                {hasMWRR && (
                  <Card className="space-y-4">
                    <h3 className="text-sm font-semibold text-[--ink]">Rendimento reale per portafoglio (MWRR)</h3>
                    <p className="text-xs text-[--muted]">
                      Il <strong className="text-[--ink]">MWRR</strong> (IRR) misura il rendimento annualizzato tenendo conto del <em>timing</em> dei tuoi acquisti e vendite.
                    </p>
                    <div className="divide-y divide-[--border]">
                      {mwrr.map((p) => (
                        <div key={p.portfolioId} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[--ink] truncate">{p.portfolioName}</p>
                            <p className="text-xs text-[--faint]">{p.txnCount} operazioni · {p.periodYears} anni · {p.currency}</p>
                          </div>
                          {p.currentValueMinor !== null && (
                            <span className="text-sm tabular-nums text-[--muted] shrink-0">{fmtEur(p.currentValueMinor)}</span>
                          )}
                          <div className="text-right shrink-0">
                            {p.mwrrPct !== null ? (
                              <span className="text-lg font-bold font-mono tabular-nums"
                                style={{ color: p.mwrrPct >= 0 ? 'var(--brand-text)' : 'var(--danger)' }}>
                                {sign(p.mwrrPct)}{fmtPct(p.mwrrPct)}/a
                              </span>
                            ) : (
                              <span className="text-sm text-[--faint]">n/d</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {dca.hasBuyTxns && (
                  <Card className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Shuffle className="size-4 text-[--muted]" strokeWidth={1.75} />
                      <h3 className="text-sm font-semibold text-[--ink]">DCA Counterfactual — Il tuo timing vs investimento automatico</h3>
                    </div>
                    <p className="text-xs text-[--muted]">
                      Confronta il rendimento dei tuoi acquisti reali con quello che avresti ottenuto investendo
                      la stessa somma totale in <strong className="text-[--ink]">rate mensili uguali</strong> (Dollar-Cost Averaging puro).
                    </p>
                    {!hasDCA ? (
                      <p className="text-sm text-[--faint]">
                        Ci vogliono almeno 3 mesi dal primo acquisto per calcolare il confronto DCA.
                        Assicurati che le operazioni abbiano quantità e prezzo unitario compilati.
                      </p>
                    ) : (
                      <>
                        {dca.results.some((r) => !r.hasHistory) && (
                          <p className="text-xs text-[--faint] bg-[--surface-2] rounded-lg px-3 py-2">
                            Gli strumenti con &ldquo;storico mancante&rdquo; richiedono il backfill dei prezzi storici
                            dalla pagina del portafoglio → sezione &ldquo;Gestione&rdquo; → &ldquo;Scarica storico prezzi&rdquo;.
                          </p>
                        )}
                        <div className="divide-y divide-[--border]">
                          {dca.results.map((r) => (
                            <div key={r.instrumentId} className="py-3 first:pt-0 last:pb-0 space-y-1">
                              <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[--ink] truncate">{r.name}</p>
                                  <p className="text-xs text-[--faint]">
                                    <span className="font-mono">{r.symbol}</span>
                                    {' · '}{r.years} anni · investito {fmtEur(r.totalCostMinor)}
                                  </p>
                                </div>
                                {!r.hasHistory ? (
                                  <Badge variant="neutral">storico mancante</Badge>
                                ) : r.diffPct !== null ? (
                                  <Badge variant={r.diffPct > 0 ? 'gain' : r.diffPct < -0.5 ? 'loss' : 'neutral'}>
                                    {sign(r.diffPct)}{r.diffPct.toFixed(2)}%/a vs DCA
                                  </Badge>
                                ) : null}
                              </div>
                              {r.hasHistory && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                  <div>
                                    <p className="text-xs text-[--faint]">CAGR reale</p>
                                    <p className={`text-sm font-medium tabular-nums ${pctColor(r.actualCAGR)}`}>
                                      {r.actualCAGR !== null ? sign(r.actualCAGR) + fmtPct(r.actualCAGR) : '—'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-[--faint]">CAGR DCA</p>
                                    <p className="text-sm font-medium tabular-nums text-[--muted]">
                                      {r.dcaCAGR !== null ? sign(r.dcaCAGR) + fmtPct(r.dcaCAGR) : '—'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-[--faint]">Valore DCA oggi</p>
                                    <p className="text-sm font-medium tabular-nums text-[--muted]">
                                      {r.dcaValueMinor !== null ? fmtEur(r.dcaValueMinor) : '—'}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </section>
    </main>
  )
}
