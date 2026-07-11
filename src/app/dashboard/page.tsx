import { requireUser } from '@/lib/dal'
import { listInstitutions } from '@/lib/institutions'
import { getInstitutionValueEur } from '@/lib/institutionValuation'
import { listAssets, getVehicleDetails } from '@/lib/assets'
import { listAccounts } from '@/lib/accounts'
import { listPortfolios } from '@/lib/portfolios'
import { cashRunwayAlert } from '@/lib/alerts/liquidity'
import { latentTaxStats } from '@/lib/tax/latent'
import { estimatedWealthTaxes } from '@/lib/tax/wealth'
import AddInstitutionForm from './AddInstitutionForm'
import AddAssetForm from './AddAssetForm'
import AssetRow from './AssetRow'
import NetWorthChart from './NetWorthChart'
import RefreshNetWorthButton from './RefreshNetWorthButton'
import { ensureTodaySnapshot, listSnapshots } from '@/lib/valuation'
import { AddSection } from '@/components/dashboard/AddSection'
import {
  Card,
  Stat, Badge, EmptyState,
} from '@/components/ui'
import Link from 'next/link'
import { Building2, ChevronRight, Wallet, AlertTriangle, Info, CheckCircle2 } from 'lucide-react'
import { computeGoalsSummary, listGoals, isGoalCompleted } from '@/lib/goals'
import { budgetStatus } from '@/lib/budgets'
import { getFiscalCalendar } from '@/lib/calendar'
import { getMarketNews } from '@/lib/prices/yahoo'
import { getDashboardLayout } from '@/lib/userSettings'
import { getOwnerInstrumentSymbols } from '@/lib/instruments'
import DashboardGrid from '@/components/dashboard/widgets/DashboardGrid'
import type { DashboardWidgetsData } from '@/components/dashboard/widgets/types'

export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<string, string> = {
  bank:   'Banca',
  broker: 'Broker',
  both:   'Banca · Broker',
}

function formatEur(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
  })
}

function formatEurCompact(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
}

interface BreakdownEntry {
  portfolios: { portfolioId: number; eurMinor: number | null }[]
  accounts:   { accountId: number; eurMinor: number }[]
}

export default async function DashboardPage() {
  const user = await requireUser()
  const institutions = listInstitutions(user.id)

  await ensureTodaySnapshot(user.id).catch(() => {})

  const snapshots = listSnapshots(user.id)
  const latest  = snapshots.at(-1) ?? null
  const prev    = snapshots.at(-2) ?? null

  const delta = latest && prev
    ? latest.net_worth_eur_minor - prev.net_worth_eur_minor
    : null

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const currentYear = now.getFullYear().toString()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const deadlineTo = new Date(now)
  deadlineTo.setDate(deadlineTo.getDate() + 30)
  const deadlineToDate = deadlineTo.toISOString().slice(0, 10)

  const newsSymbols = getOwnerInstrumentSymbols(user.id)

  const [instValues, latentTax, wealthTaxes, goalsSummary, deadlineEvents, newsArticles] = await Promise.all([
    Promise.all(institutions.map((inst) => getInstitutionValueEur(user.id, inst.id, today))),
    latentTaxStats(user.id).catch(() => null),
    estimatedWealthTaxes(user.id, currentYear).catch(() => null),
    computeGoalsSummary(user.id).catch(() => ({ totalCashMinor: 0, totalAllocatedMinor: 0, freeOperatingCashMinor: 0 })),
    getFiscalCalendar(user.id, today, deadlineToDate).catch((): never[] => []),
    getMarketNews(newsSymbols, 6).catch((): never[] => []),
  ])

  const assets     = listAssets(user.id)
  const vehicleDetailsByAsset = new Map(
    assets.filter((a) => a.kind === 'vehicle').map((a) => [a.id, getVehicleDetails(a.id)]),
  )
  const accounts   = listAccounts(user.id)
  const portfolios = listPortfolios(user.id)
  const goals      = listGoals(user.id)
  const budgetStat = budgetStatus(user.id, currentMonth)
  const savedLayout = getDashboardLayout(user.id)

  const runway = await cashRunwayAlert(user.id).catch(() => null)

  // Institution names for badge display
  const institutionMap = new Map(institutions.map(i => [i.id, i.name]))

  // Per-account e per-portfolio EUR value dall'ultimo snapshot
  const accountValueMap   = new Map<number, number>()
  const portfolioValueMap = new Map<number, number>()

  // Sparkline per singolo portafoglio (ultimi 60 snapshot)
  const portfolioSparklines = new Map<number, { date: string; value: number }[]>()
  for (const snap of snapshots.slice(-60)) {
    if (!snap.breakdown) continue
    try {
      const bd = JSON.parse(snap.breakdown) as BreakdownEntry
      if (snap === latest) {
        for (const a of bd.accounts ?? [])   accountValueMap.set(a.accountId, a.eurMinor)
        for (const p of bd.portfolios ?? []) if (p.eurMinor !== null) portfolioValueMap.set(p.portfolioId, p.eurMinor)
      }
      for (const p of bd.portfolios ?? []) {
        if (p.eurMinor === null) continue
        if (!portfolioSparklines.has(p.portfolioId)) portfolioSparklines.set(p.portfolioId, [])
        portfolioSparklines.get(p.portfolioId)!.push({ date: snap.date, value: p.eurMinor })
      }
    } catch {
      // ignore malformed breakdown
    }
  }
  // ── Dati widget panoramica ─────────────────────────────────────────────────
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysRemainingInMonth = Math.max(1, lastDayOfMonth - now.getDate() + 1)

  const widgetsData: DashboardWidgetsData = {
    goals: {
      goals: goals.map((g) => ({
        id:        g.id,
        name:      g.name,
        color:     g.color_hex,
        current:   g.current_allocated_minor,
        target:    g.target_amount_minor,
        completed: isGoalCompleted(g),
      })),
      summary: goalsSummary,
    },
    budget: {
      month:    currentMonth,
      total: {
        spentMinor: budgetStat.total.spent_minor,
        limitMinor: budgetStat.total.limit_minor,
        pct:        budgetStat.total.pct,
      },
      topCategories: budgetStat.perCategory.slice(0, 4).map((c) => ({
        name:       c.category_name ?? 'Altro',
        color:      c.color ?? null,
        spentMinor: c.spent_minor,
        limitMinor: c.limit_minor,
        pct:        c.pct,
      })),
      daysRemainingInMonth,
    },
    investments: {
      portfolios: portfolios.map((pf) => ({
        id:       pf.id,
        name:     pf.name,
        eurMinor: portfolioValueMap.get(pf.id) ?? null,
        sparkline: portfolioSparklines.get(pf.id) ?? [],
      })),
      totalInvestmentsMinor: latest?.investments_eur_minor ?? 0,
    },
    deadlines: {
      upcoming: deadlineEvents.slice(0, 6).map((e) => ({
        date:        e.date,
        label:       e.label,
        source:      e.source,
        amountMinor: e.amountMinor,
      })),
    },
    news: {
      articles: newsArticles,
    },
  }

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-8">

      {/* ── Banner liquidità critica ──────────────────────────────────────── */}
      {runway?.status === 'CRITICAL_SHORTAGE' && (
        <Card className="border-[--danger] bg-[--danger]/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 text-[--danger] shrink-0 mt-0.5" strokeWidth={1.75} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[--danger]">
                Rischio scoperto entro i prossimi {runway.windowDays} giorni
              </p>
              <p className="text-sm text-[--muted] mt-0.5">
                Deficit stimato: <strong className="text-[--danger]">{formatEur(runway.deficitMinor)}</strong>.
                Considera di ridurre le allocazioni agli obiettivi o di posticipare alcune uscite.
              </p>
              <Link href="/dashboard/scadenziario" className="text-xs text-[--brand-text] hover:underline mt-1.5 inline-block">
                Vedi lo scadenziario →
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* ── Net worth hero ────────────────────────────────────────────────── */}
      <Card noPadding className="overflow-hidden">
        <div className="p-6 pb-4">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">
                Patrimonio netto
              </p>
              {latest ? (
                <div className="flex items-end gap-3 flex-wrap">
                  <span className="text-4xl font-bold font-mono tabular-nums text-[--ink] leading-none">
                    {formatEur(latest.net_worth_eur_minor)}
                  </span>
                  {delta !== null && (
                    delta === 0 ? (
                      <span className="mb-1 text-sm font-mono tabular-nums text-[--muted]">
                        0,00 € (0,00%)
                      </span>
                    ) : (
                      <Badge variant={delta > 0 ? 'gain' : 'loss'} className="mb-1">
                        {delta > 0 ? '+' : '−'}
                        {formatEurCompact(Math.abs(delta))}
                        {prev && prev.net_worth_eur_minor !== 0 && (
                          <> ({delta > 0 ? '+' : '−'}{(Math.abs(delta) / prev.net_worth_eur_minor * 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)</>
                        )}
                      </Badge>
                    )
                  )}
                </div>
              ) : (
                <span className="text-[--muted] text-sm">Calcolo in corso…</span>
              )}
              {latest && (
                <div className="flex items-center gap-1.5 text-xs text-[--faint]">
                  {latest.stale === 1 ? (
                    <Info className="size-3 text-[--warning] shrink-0" strokeWidth={1.75} />
                  ) : (
                    <CheckCircle2 className="size-3 text-[--brand-text] shrink-0" strokeWidth={1.75} />
                  )}
                  <span className={latest.stale === 1 ? 'text-[--warning]' : ''}>
                    {latest.stale === 1 ? 'Dati parziali · ' : ''}Aggiornato al {latest.date}
                  </span>
                  <RefreshNetWorthButton />
                </div>
              )}
            </div>

            {latest && (
              <div className="flex gap-8 flex-wrap">
                <Stat
                  label="Investimenti"
                  value={formatEurCompact(latest.investments_eur_minor)}
                  size="sm"
                />
                <Stat
                  label="Conti correnti"
                  value={formatEurCompact(latest.accounts_eur_minor)}
                  size="sm"
                />
                {latest.other_assets_eur_minor !== 0 && (
                  <Stat
                    label="Altri beni"
                    value={formatEurCompact(latest.other_assets_eur_minor)}
                    size="sm"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Micro-Card Fiscale ────────────────────────────────────────── */}
        {latest && (latentTax || wealthTaxes) ? (
          <div className="mx-6 mb-4 rounded-xl border border-[--border] bg-[--surface-2] overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-[--border]">
              <div className="px-4 py-3 text-center">
                <p className="text-[10px] font-medium uppercase tracking-widest text-[--faint] mb-1">Lordo</p>
                <p className="font-mono tabular-nums text-sm font-semibold text-[--ink]">
                  {formatEur(latest.net_worth_eur_minor)}
                </p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="text-[10px] font-medium uppercase tracking-widest text-[--faint] mb-1">Imposte stimate</p>
                <p className="font-mono tabular-nums text-sm font-semibold text-[--danger]">
                  −{formatEur((latentTax?.latentTaxMinor ?? 0) + (wealthTaxes?.totalMinor ?? 0))}
                </p>
                <p className="text-[10px] text-[--faint] mt-0.5">latenti + bollo</p>
              </div>
              <div className="px-4 py-3 text-center">
                <p className="text-[10px] font-medium uppercase tracking-widest text-[--faint] mb-1">Netto reale</p>
                <p className="font-mono tabular-nums text-sm font-semibold text-[--brand-text]">
                  {formatEur(latest.net_worth_eur_minor - (latentTax?.latentTaxMinor ?? 0) - (wealthTaxes?.totalMinor ?? 0))}
                </p>
              </div>
            </div>
            <div className="border-t border-[--border] px-4 py-2 flex justify-center">
              <Link
                href="/dashboard/tasse"
                className="inline-flex items-center gap-1 text-xs text-[--brand-text] hover:underline"
              >
                <ChevronRight className="size-3" />
                Dettaglio fiscale completo
              </Link>
            </div>
          </div>
        ) : (
          <div className="mx-6 mb-4">
            <Link
              href="/dashboard/tasse"
              className="inline-flex items-center gap-1.5 text-xs text-[--brand-text] hover:underline"
            >
              <ChevronRight className="size-3.5" />
              Dettaglio fiscale — tasse latenti, plus/minus realizzate, bollo/IVAFE
            </Link>
          </div>
        )}

        <div className="px-2 pb-4">
          <NetWorthChart snapshots={snapshots} />
        </div>
      </Card>

      {/* ── Widget panoramica ─────────────────────────────────────────────── */}
      <DashboardGrid data={widgetsData} initialLayout={savedLayout} />

      {/* ── Conti correnti (accesso rapido) ──────────────────────────────── */}
      {accounts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[--ink]">Conti correnti</h2>
          <Card noPadding className="overflow-hidden divide-y divide-[--border]">
            {accounts.map((acc) => {
              const instName = institutionMap.get(acc.institution_id)
              const eurMinor = accountValueMap.get(acc.id)
              return (
                <Link
                  key={acc.id}
                  href={`/dashboard/accounts/${acc.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-[--surface-2] transition-colors duration-100 group"
                >
                  <div className="size-9 rounded-xl bg-[--surface-2] ring-1 ring-[--border] flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-[--muted]">
                      {acc.name[0].toUpperCase()}
                    </span>
                  </div>
                  <p className="flex-1 min-w-0 text-sm font-medium text-[--ink] truncate">
                    {acc.name}
                  </p>
                  {instName && (
                    <Badge variant="neutral" className="shrink-0">{instName}</Badge>
                  )}
                  <span className="font-mono tabular-nums text-sm text-[--ink] shrink-0">
                    {eurMinor !== undefined ? formatEurCompact(eurMinor) : '—'}
                  </span>
                  <ChevronRight className="size-4 text-[--faint] group-hover:text-[--muted] transition-colors shrink-0" />
                </Link>
              )
            })}
          </Card>
        </section>
      )}

      {/* ── Portafogli d'investimento (accesso rapido) ───────────────────── */}
      {portfolios.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[--ink]">Portafogli d&apos;investimento</h2>
          <Card noPadding className="overflow-hidden divide-y divide-[--border]">
            {portfolios.map((pf) => {
              const instName = institutionMap.get(pf.institution_id)
              const eurMinor = portfolioValueMap.get(pf.id)
              return (
                <Link
                  key={pf.id}
                  href={`/dashboard/portfolios/${pf.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-[--surface-2] transition-colors duration-100 group"
                >
                  <div className="size-9 rounded-xl bg-[--brand-subtle] flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-[--brand-text]">
                      {pf.name[0].toUpperCase()}
                    </span>
                  </div>
                  <p className="flex-1 min-w-0 text-sm font-medium text-[--ink] truncate">
                    {pf.name}
                  </p>
                  {instName && (
                    <Badge variant="neutral" className="shrink-0">{instName}</Badge>
                  )}
                  <span className="font-mono tabular-nums text-sm text-[--ink] shrink-0">
                    {eurMinor !== undefined ? formatEurCompact(eurMinor) : '—'}
                  </span>
                  <ChevronRight className="size-4 text-[--faint] group-hover:text-[--muted] transition-colors shrink-0" />
                </Link>
              )
            })}
          </Card>
        </section>
      )}

      {/* ── Istituzioni ───────────────────────────────────────────────────── */}
      <AddSection
        title="Istituzioni"
        addLabel="Aggiungi"
        form={
          <Card>
            <AddInstitutionForm />
          </Card>
        }
      >
        {institutions.length === 0 ? (
          <Card>
            <EmptyState
              icon={Building2}
              title="Nessuna istituzione"
              description="Aggiungi la tua prima banca o broker per iniziare a tracciare il patrimonio."
            />
          </Card>
        ) : (
          <Card noPadding className="overflow-hidden divide-y divide-[--border]">
            {institutions.map((inst, i) => {
              const val = instValues[i]
              return (
                <Link
                  key={inst.id}
                  href={`/dashboard/institutions/${inst.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-[--surface-2] transition-colors duration-100 group"
                >
                  <div className="size-9 rounded-xl bg-[--brand-subtle] flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-[--brand-text]">
                      {inst.name[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[--ink] truncate">{inst.name}</p>
                    <p className="text-xs text-[--muted]">{KIND_LABEL[inst.kind] ?? inst.kind}</p>
                  </div>
                  <span className="font-mono tabular-nums text-sm text-[--ink] shrink-0">
                    {formatEur(val.valueEurMinor)}
                    {val.stale && <span className="text-[--warning] ml-1" title="Valore parziale">*</span>}
                  </span>
                  <ChevronRight className="size-4 text-[--faint] group-hover:text-[--muted] transition-colors shrink-0" />
                </Link>
              )
            })}
          </Card>
        )}
      </AddSection>

      {/* ── Altri beni ────────────────────────────────────────────────────── */}
      <AddSection
        title="Altri beni"
        subtitle="Liquidità, immobili, veicoli e altro — concorrono al patrimonio netto."
        addLabel="Aggiungi"
        form={
          <Card>
            <AddAssetForm />
          </Card>
        }
      >
        {assets.length === 0 ? (
          <Card>
            <EmptyState
              icon={Wallet}
              title="Nessun bene aggiunto"
              description="Aggiungi contanti, un immobile o un veicolo per includerli nel patrimonio."
            />
          </Card>
        ) : (
          <Card noPadding className="overflow-hidden divide-y divide-[--border]">
            {assets.map((asset) => (
              <AssetRow key={asset.id} asset={asset} vehicleDetails={vehicleDetailsByAsset.get(asset.id)} />
            ))}
          </Card>
        )}
      </AddSection>
    </main>
  )
}
