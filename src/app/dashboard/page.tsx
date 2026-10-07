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
import NetWorthHero from './NetWorthHero'
import CompositionBar from './CompositionBar'
import RefreshNetWorthButton from './RefreshNetWorthButton'
import { ensureTodaySnapshot, listSnapshots } from '@/lib/valuation'
import { AddSection } from '@/components/dashboard/AddSection'
import {
  Card,
  EmptyState, HeroLink, StickyBar, PAGE_SHELL,
} from '@/components/ui'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { Building2, ChevronRight, Wallet, AlertTriangle } from 'lucide-react'
import { computeGoalsSummary, listGoals, isGoalCompleted } from '@/lib/goals'
import { budgetStatus } from '@/lib/budgets'
import { getScadenziarioEvents } from '@/lib/calendar'
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
    style: 'currency', useGrouping: 'always',
    currency: 'EUR',
  })
}

function formatEurCompact(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency', useGrouping: 'always',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
}

/** Riga cliccabile delle liste di accesso rapido (conti, portafogli, istituzioni). */
function EntityRow({ href, name, sub, value, accent }: {
  href: string
  name: string
  sub?: string
  value: React.ReactNode
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 px-4 py-3 hover:bg-(--surface-2) active:bg-(--surface-2) transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--ring)"
    >
      <span
        className={cn(
          'size-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-semibold',
          accent ? 'bg-(--brand-subtle) text-(--brand-text)' : 'bg-(--surface-2) ring-1 ring-(--border) text-(--muted)',
        )}
        aria-hidden
      >
        {name[0]?.toUpperCase()}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-(--ink) truncate">{name}</span>
        {sub && <span className="block text-xs text-(--muted) truncate">{sub}</span>}
      </span>
      <span className="font-mono tabular-nums text-sm font-medium text-(--ink) shrink-0">{value}</span>
      <ChevronRight className="size-4 text-(--faint) group-hover:text-(--ink) group-hover:translate-x-0.5 transition-[color,transform] duration-200 [transition-timing-function:var(--ease-spring)] shrink-0" />
    </Link>
  )
}

/** Lista raggruppata della colonna laterale: titolo piccolo + righe in un unico contenitore. */
function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="px-1 text-sm font-semibold text-(--ink)">{title}</h2>
      <Card noPadding className="overflow-hidden divide-y divide-(--border)">
        {children}
      </Card>
    </section>
  )
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
    getScadenziarioEvents(user.id, today, deadlineToDate).catch((): never[] => []),
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
      // Cose su cui agire: uscite cash imminenti + opportunità con scadenza
      // (crediti fiscali, consenso banca, harvesting, obiettivi a rischio).
      upcoming: deadlineEvents
        .filter((e) => e.kind === 'opportunity' || (e.kind === 'cash' && e.direction === 'out'))
        .slice(0, 6)
        .map((e) => ({
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

  const estimatedTaxMinor = (latentTax?.latentTaxMinor ?? 0) + (wealthTaxes?.totalMinor ?? 0)

  // Composizione del patrimonio per la barra del hero (solo blocchi positivi)
  const compositionParts = latest ? [
    { label: 'Investimenti',   minor: latest.investments_eur_minor,  bar: 'bg-(--brand)' },
    { label: 'Conti correnti', minor: latest.accounts_eur_minor,     bar: 'bg-(--info)' },
    { label: 'Altri beni',     minor: latest.other_assets_eur_minor, bar: 'bg-(--warning)' },
  ].filter((c) => c.minor > 0) : []
  const compositionTotal = compositionParts.reduce((sum, c) => sum + c.minor, 0)
  const composition = compositionParts.map((c) => ({
    label: c.label,
    bar:   c.bar,
    value: formatEurCompact(c.minor),
    pct:   (c.minor / compositionTotal) * 100,
  }))

  return (
    <>
    {latest && (
      <StickyBar watchId="networth-value">
        <span className="text-sm font-medium text-(--ink)">Patrimonio netto</span>
        <span className="text-sm font-semibold font-mono tabular-nums text-(--ink)">{formatEur(latest.net_worth_eur_minor)}</span>
        {estimatedTaxMinor > 0 && (
          <span className="text-xs text-(--muted) ml-auto font-mono tabular-nums">
            Netto reale {formatEur(latest.net_worth_eur_minor - estimatedTaxMinor)}
          </span>
        )}
      </StickyBar>
    )}
    <main className={`${PAGE_SHELL} space-y-10`}>

      {/* ── Banner liquidità critica ──────────────────────────────────────── */}
      {runway?.status === 'CRITICAL_SHORTAGE' && (
        <Card className="border-(--danger) bg-(--danger)/5">
          <div className="flex items-start gap-3.5">
            <div className="size-9 rounded-xl bg-(--danger-subtle) flex items-center justify-center shrink-0">
              <AlertTriangle className="size-4 text-(--danger)" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-(--danger)">
                Rischio scoperto entro i prossimi {runway.windowDays} giorni
              </p>
              <p className="text-sm text-(--muted) mt-0.5">
                Deficit stimato: <strong className="text-(--danger)">{formatEur(runway.deficitMinor)}</strong>.
                Considera di ridurre le allocazioni agli obiettivi o di posticipare alcune uscite.
              </p>
              <Link href="/dashboard/scadenziario" className="text-xs text-(--brand-text) hover:underline mt-1.5 inline-block">
                Vedi lo scadenziario →
              </Link>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_24rem] min-[131rem]:grid-cols-[minmax(0,1fr)_30rem] gap-x-8 2xl:gap-x-10 gap-y-10 items-start xl:items-stretch">

        {/* ══ Colonna principale ════════════════════════════════════════════ */}
        <div className="min-w-0 flex flex-col gap-10">

          {/* ── Net worth hero ──────────────────────────────────────────── */}
          <NetWorthHero
            valueId="networth-value"
            points={snapshots.map((snap) => ({ date: snap.date, value: snap.net_worth_eur_minor }))}
            stale={latest?.stale === 1}
            refresh={<RefreshNetWorthButton />}
            aside={<CompositionBar parts={composition} className="xl:hidden" />}
            footer={
              <div className="flex items-center gap-x-8 gap-y-3 flex-wrap border-t border-(--border) px-6 sm:px-8 py-4 text-sm">
                {latest && (latentTax || wealthTaxes) && (
                  <>
                    <p className="text-(--muted)">
                      Imposte stimate{' '}
                      <span className="ml-1 font-mono tabular-nums font-medium text-(--ink)">
                        −{formatEur(estimatedTaxMinor)}
                      </span>
                    </p>
                    <p className="text-(--muted)">
                      Netto reale{' '}
                      <span className="ml-1 font-mono tabular-nums font-medium text-(--ink)">
                        {formatEur(latest.net_worth_eur_minor - estimatedTaxMinor)}
                      </span>
                    </p>
                  </>
                )}
                <HeroLink href="/dashboard/tasse" className="sm:ml-auto">Dettaglio fiscale</HeroLink>
              </div>
            }
          />

          {/* ── Widget panoramica ─────────────────────────────────────────────── */}
          <DashboardGrid data={widgetsData} initialLayout={savedLayout} />

        </div>

        {/* ══ Colonna laterale: dove sono i soldi ══════════════════════════ */}
        <aside className="min-w-0 space-y-8">
          {composition.length > 0 && (
            <Card className="hidden xl:block space-y-4">
              <h2 className="text-sm font-semibold text-(--ink)">Composizione</h2>
              <CompositionBar parts={composition} stacked />
            </Card>
          )}

          {accounts.length > 0 && (
            <RailSection title="Conti correnti">
              {accounts.map((acc) => {
                const eurMinor = accountValueMap.get(acc.id)
                return (
                  <EntityRow
                    key={acc.id}
                    href={`/dashboard/accounts/${acc.id}`}
                    name={acc.name}
                    sub={institutionMap.get(acc.institution_id)}
                    value={eurMinor !== undefined ? formatEurCompact(eurMinor) : '—'}
                  />
                )
              })}
            </RailSection>
          )}

          {portfolios.length > 0 && (
            <RailSection title="Portafogli">
              {portfolios.map((pf) => {
                const eurMinor = portfolioValueMap.get(pf.id)
                return (
                  <EntityRow
                    key={pf.id}
                    href={`/dashboard/portfolios/${pf.id}`}
                    name={pf.name}
                    sub={institutionMap.get(pf.institution_id)}
                    value={eurMinor !== undefined ? formatEurCompact(eurMinor) : '—'}
                  />
                )
              })}
            </RailSection>
          )}

          {/* ── Istituzioni ───────────────────────────────────────────────────── */}
          <AddSection
            title="Istituzioni"
            icon={<Building2 className="size-4 text-(--muted)" strokeWidth={1.75} />}
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
              <Card noPadding className="overflow-hidden divide-y divide-(--border)">
                {institutions.map((inst, i) => {
                  const val = instValues[i]
                  return (
                    <EntityRow
                      key={inst.id}
                      href={`/dashboard/institutions/${inst.id}`}
                      name={inst.name}
                      sub={KIND_LABEL[inst.kind] ?? inst.kind}
                      value={
                        <>
                          {formatEurCompact(val.valueEurMinor)}
                          {val.stale && <span className="text-(--warning-text) ml-1" title="Valore parziale">*</span>}
                        </>
                      }
                      />
                  )
                })}
              </Card>
            )}
          </AddSection>

                  </aside>
      </div>

      {/* ── Altri beni ────────────────────────────────────────────────────── */}
      <AddSection
        title="Altri beni"
        icon={<Wallet className="size-4 text-(--muted)" strokeWidth={1.75} />}
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
          <Card noPadding className="overflow-hidden divide-y divide-(--border)">
            {assets.map((asset) => (
              <AssetRow key={asset.id} asset={asset} vehicleDetails={vehicleDetailsByAsset.get(asset.id)} />
            ))}
          </Card>
        )}
      </AddSection>
    </main>
    </>
  )
}
