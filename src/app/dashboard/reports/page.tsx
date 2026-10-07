// Report mensile — il racconto operativo del mese selezionato.
// Ogni numero arriva con la sua baseline (mese tipico, precedente, anno scorso)
// e ogni aggregato si apre sulle transazioni che lo compongono.
// La diagnosi globale non filtrabile resta in /dashboard/statistiche.
import Link from 'next/link'
import { requireUser } from '@/lib/dal'
import { listAccounts } from '@/lib/accounts'
import { availableMonths } from '@/lib/reports'
import { buildMonthReport, monthLabelIt } from '@/lib/monthReport'
import type { MonthCategoryRow, MonthMerchantRow, MonthTxn } from '@/lib/monthReport'
import {
  FileBarChart2, Sparkles, ChevronDown, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { Card, EmptyState, Badge, Button, Eyebrow, HeroShell, InsightCard, PageHeader, StickyBar, PAGE_SHELL } from '@/components/ui'
import SpendingTrend from './SpendingTrend'
import MonthNav from './MonthNav'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ month?: string; account?: string }>
}

// ── Formattazione ─────────────────────────────────────────────────────────────

function fmtEur(minor: number, decimals = 0): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency', useGrouping: 'always', currency: 'EUR',
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  })
}
function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}
function pctOf(part: number, total: number): number {
  if (total === 0) return 0
  return Math.round((Math.abs(part) / Math.abs(total)) * 100)
}
function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1) }

/** Badge di scostamento per una SPESA: salire è male, scendere è bene. */
function DeltaBadge({ deltaMinor, baseMinor }: { deltaMinor: number; baseMinor: number }) {
  if (baseMinor <= 0) return null
  const pct = Math.round((deltaMinor / baseMinor) * 100)
  if (pct === 0) return null
  const up = deltaMinor > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium font-mono tabular-nums ${up ? 'text-(--danger-text)' : 'text-(--brand-text)'}`}>
      {up ? <ArrowUpRight className="size-3" strokeWidth={2} aria-hidden /> : <ArrowDownRight className="size-3" strokeWidth={2} aria-hidden />}
      {up ? '+' : '−'}{Math.abs(pct)}%
    </span>
  )
}

// ── Righe espandibili (drill-down nativo, accessibile da tastiera) ────────────

const SUMMARY = 'flex items-center gap-3 cursor-pointer list-none rounded-lg -mx-2 px-2 py-1.5 select-none hover:bg-(--surface-2) active:bg-(--surface-2) transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-(--ring) [&::-webkit-details-marker]:hidden'

function TxnList({ txns }: { txns: MonthTxn[] }) {
  return (
    <ul className="mt-2 divide-y divide-(--border) border-t border-(--border)">
      {txns.map((t) => (
        <li key={t.id} className="flex items-baseline gap-3 py-2 text-sm">
          <span className="text-xs text-(--muted) tabular-nums w-12 shrink-0">{fmtDate(t.booked_date)}</span>
          <span className="text-(--ink) truncate flex-1 min-w-0">{t.label}</span>
          <span className="font-mono tabular-nums text-(--ink) shrink-0">{fmtEur(t.amountMinor, 2)}</span>
        </li>
      ))}
    </ul>
  )
}

function CategoryRow({ cat, totalOutflow }: { cat: MonthCategoryRow; totalOutflow: number }) {
  const barPct = pctOf(cat.totalMinor, totalOutflow)
  const color  = cat.color ?? 'var(--faint)'
  return (
    <details className="disclosure group py-2 first:pt-0 last:pb-0">
      {/* La barra di proporzione sta nel summary: si legge anche a riga chiusa */}
      <summary className={`${SUMMARY} flex-wrap gap-y-2`}>
        <span className="size-2 rounded-full shrink-0" style={{ background: color }} aria-hidden />
        <span className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm text-(--ink) truncate">{cat.categoryName}</span>
          {cat.deltaMinor !== null && cat.typicalMinor !== null && Math.abs(cat.deltaMinor) >= 1000 && (
            <DeltaBadge deltaMinor={cat.deltaMinor} baseMinor={cat.typicalMinor} />
          )}
        </span>
        <span className="shrink-0 text-xs font-mono tabular-nums text-(--muted) flex items-baseline gap-1.5">
          <span className="text-(--ink) text-sm font-medium">{fmtEur(cat.totalMinor)}</span>
          <span className="w-8 text-right">{barPct}%</span>
          <span className="w-7 text-right">{cat.count}×</span>
        </span>
        <ChevronDown className="size-4 text-(--faint) shrink-0 transition-transform duration-200 ease-out-strong group-open:rotate-180" strokeWidth={1.75} aria-hidden />
        <span className="basis-full h-1 bg-(--surface-2) rounded-full overflow-hidden" aria-hidden>
          <span className="block h-full rounded-full" style={{ width: `${Math.max(barPct, 1)}%`, background: color }} />
        </span>
      </summary>
      {cat.typicalMinor !== null && (
        <p className="text-xs text-(--muted) mt-2">
          Mese tipico: {fmtEur(cat.typicalMinor)} (mediana ultimi 6 mesi)
        </p>
      )}
      <TxnList txns={cat.txns} />
    </details>
  )
}

function MerchantRow({ m, rank, totalOutflow }: { m: MonthMerchantRow; rank: number; totalOutflow: number }) {
  const barPct = pctOf(m.totalMinor, totalOutflow)
  return (
    <details className="disclosure group py-2.5 first:pt-0 last:pb-0">
      <summary className={SUMMARY}>
        <span className="text-xs tabular-nums text-(--faint) w-5 shrink-0 text-right">{rank}</span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-sm text-(--ink) truncate">{m.label}</span>
            {m.isNew && <Badge variant="neutral">nuovo</Badge>}
          </span>
          {m.categoryName && <span className="block text-xs text-(--muted)">{m.categoryName}</span>}
        </span>
        <span className="hidden sm:block w-24 h-1 bg-(--surface-2) rounded-full overflow-hidden shrink-0" aria-hidden>
          <span className="block h-full bg-(--muted)/70 rounded-full" style={{ width: `${barPct}%` }} />
        </span>
        <span className="text-right shrink-0">
          <span className="block text-sm font-medium font-mono tabular-nums text-(--ink)">{fmtEur(m.totalMinor)}</span>
          <span className="block text-xs text-(--muted)">×{m.count}</span>
        </span>
        <ChevronDown className="size-4 text-(--faint) shrink-0 transition-transform duration-200 ease-out-strong group-open:rotate-180" strokeWidth={1.75} aria-hidden />
      </summary>
      <TxnList txns={m.txns} />
    </details>
  )
}

// ── Pagina ────────────────────────────────────────────────────────────────────

export default async function ReportsPage({ searchParams }: Props) {
  const { month: monthParam, account: accountParam } = await searchParams
  const user = await requireUser()

  const accounts = listAccounts(user.id)

  // Validazione parametri: valori invalidi degradano al default, mai a un crash
  const parsedAccount = accountParam !== undefined ? Number(accountParam) : null
  const accountId = parsedAccount !== null
    && Number.isInteger(parsedAccount)
    && accounts.some((a) => a.id === parsedAccount)
    ? parsedAccount
    : null

  const months = availableMonths(user.id, accountId ?? undefined)
  const month  = monthParam !== undefined && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) && months.includes(monthParam)
    ? monthParam
    : months[0]

  if (!month || months.length === 0) {
    return (
      <main className={`${PAGE_SHELL} space-y-8`}>
        <PageHeader breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Report' }]} title="Report" />
        <EmptyState
          icon={FileBarChart2}
          title="Nessun movimento da raccontare"
          description="Il report mensile si costruisce sui movimenti bancari: collega un conto o importa un CSV per iniziare."
          action={
            <Link href="/dashboard/accounts">
              <Button variant="secondary">Vai ai conti</Button>
            </Link>
          }
        />
      </main>
    )
  }

  const r = buildMonthReport(user.id, month, accountId ?? undefined)
  const hasNovelties = r.newMerchants.length > 0 || r.ceased.length > 0 || r.priceMoves.length > 0

  // Top esercenti su due colonne (da xl in su): 1…n/2 a sinistra, il resto a destra
  const merchantSplit = Math.ceil(r.merchants.length / 2)

  return (
    <>
    <StickyBar watchId="report-title" interactive>
      <span className="text-sm font-medium text-(--ink)">{cap(monthLabelIt(r.month))}</span>
      {r.hasData && (
        <span className="text-sm text-(--muted) font-mono tabular-nums">
          Uscite <span className="font-semibold text-(--ink)">{fmtEur(r.totalOutflowMinor)}</span>
        </span>
      )}
      <div className="ml-auto">
        <MonthNav compact months={months} month={r.month} accounts={accounts} accountId={accountId} />
      </div>
    </StickyBar>
    <main className={`${PAGE_SHELL} space-y-8`}>
      {/* ── Testata: mese + filtri ─────────────────────────────────────────── */}
      <PageHeader
        breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Report' }]}
        titleId="report-title"
        title={cap(monthLabelIt(r.month))}
        description={r.isPartialMonth
          ? `Mese in corso · dati fino al giorno ${r.daysElapsed}`
          : `Report del mese · ${r.txCount} movimenti`}
        actions={<MonthNav months={months} month={r.month} accounts={accounts} accountId={accountId} />}
      />

      {!r.hasData ? (
        <EmptyState
          icon={FileBarChart2}
          title="Nessun movimento in questo mese"
          description="Prova un altro mese o un altro conto."
        />
      ) : (
        <>
          {/* ── Verdetto: la risposta in 5 secondi ───────────────────────────── */}
          <HeroShell innerClassName="grid gap-x-14 gap-y-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center p-6 sm:p-8">
            <div className="space-y-4 min-w-0">
              <Eyebrow>{r.isPartialMonth ? 'Mese in corso' : 'Verdetto del mese'}</Eyebrow>
              {r.verdict && (
                <div className="space-y-2">
                  <p className={`text-2xl sm:text-3xl font-bold font-display leading-tight tracking-[-0.02em] [text-wrap:balance] text-(--ink)`}>
                    {r.verdict.headline}
                  </p>
                  {r.verdict.detail && (
                    <p className="text-sm text-(--muted) max-w-[75ch]">{r.verdict.detail}</p>
                  )}
                </div>
              )}

            {(r.ranking || r.baseline.prevMonthOutflowMinor !== null || r.baseline.yoyOutflowMinor !== null) && (
              <div className="flex items-center gap-2 flex-wrap text-xs text-(--muted)">
                {r.ranking && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-(--surface-2) px-2 py-1">
                    <Sparkles className="size-3.5 text-(--faint)" strokeWidth={1.75} aria-hidden />
                    {r.ranking.rank}° mese più costoso degli ultimi {r.ranking.monthsCompared}
                  </span>
                )}
                {r.baseline.prevMonthOutflowMinor !== null && r.baseline.prevMonth && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-(--surface-2) px-2 py-1">
                    vs {monthLabelIt(r.baseline.prevMonth).split(' ')[0]}
                    <DeltaBadge
                      deltaMinor={r.totalOutflowMinor - r.baseline.prevMonthOutflowMinor}
                      baseMinor={r.baseline.prevMonthOutflowMinor}
                    />
                  </span>
                )}
                {r.baseline.yoyOutflowMinor !== null && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-(--surface-2) px-2 py-1">
                    vs un anno fa
                    <DeltaBadge
                      deltaMinor={r.totalOutflowMinor - r.baseline.yoyOutflowMinor}
                      baseMinor={r.baseline.yoyOutflowMinor}
                    />
                  </span>
                )}
              </div>
            )}


              {r.transfersOutMinor > 0 && (
                <p className="text-xs text-(--muted) max-w-[75ch]">
                  Trasferimenti tra conti propri esclusi: {fmtEur(r.transfersOutMinor)} in uscita
                  (non sono spesa: il patrimonio non cambia).
                </p>
              )}
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4 gap-x-10 gap-y-6 border-t border-(--border) pt-5 xl:border-t-0 xl:pt-0 xl:border-l xl:pl-14">
              <div className="space-y-1.5">
                <dt className="text-xs font-medium text-(--muted)">Uscite</dt>
                <dd className="flex items-end gap-2 flex-wrap">
                  <span className="text-3xl sm:text-4xl font-extrabold font-display tabular-nums leading-none tracking-[-0.02em] text-(--ink)">{fmtEur(r.totalOutflowMinor)}</span>
                  {r.baseline.typicalOutflowMinor !== null && !r.isPartialMonth && (
                    <DeltaBadge
                      deltaMinor={r.totalOutflowMinor - r.baseline.typicalOutflowMinor}
                      baseMinor={r.baseline.typicalOutflowMinor}
                    />
                  )}
                </dd>
                {r.baseline.typicalOutflowMinor !== null && (
                  <dd className="text-xs text-(--muted)">tipico {fmtEur(r.baseline.typicalOutflowMinor)}</dd>
                )}
              </div>
              <div className="space-y-1.5">
                <dt className="text-xs font-medium text-(--muted)">Entrate</dt>
                <dd className="text-3xl sm:text-4xl font-extrabold font-display tabular-nums leading-none tracking-[-0.02em] text-(--ink)">{fmtEur(r.totalInflowMinor)}</dd>
                {r.baseline.typicalInflowMinor !== null && (
                  <dd className="text-xs text-(--muted)">tipico {fmtEur(r.baseline.typicalInflowMinor)}</dd>
                )}
              </div>
              <div className="space-y-1.5">
                <dt className="text-xs font-medium text-(--muted)">Saldo netto</dt>
                <dd className={`text-3xl sm:text-4xl font-extrabold font-display tabular-nums leading-none tracking-[-0.02em] ${r.netMinor >= 0 ? 'text-(--brand-text)' : 'text-(--danger-text)'}`}>
                  {r.netMinor >= 0 ? '+' : ''}{fmtEur(r.netMinor)}
                </dd>
              </div>
              <div className="space-y-1.5">
                <dt className="text-xs font-medium text-(--muted)">Media al giorno</dt>
                <dd className="text-3xl sm:text-4xl font-extrabold font-display tabular-nums leading-none tracking-[-0.02em] text-(--ink)">{fmtEur(r.avgDailyMinor)}</dd>
                <dd className="text-xs text-(--muted)">
                  su {r.daysElapsed} giorni{r.isPartialMonth ? ' trascorsi' : ''}
                </dd>
              </div>
            </dl>
          </HeroShell>

          {/* ── Considerazioni del mese ──────────────────────────────────────── */}
          {r.insights.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-(--ink)">Cosa è successo di notevole</h2>
              {/* flex + grow: l'ultima riga si allarga, mai celle vuote a destra */}
              <div className="flex flex-wrap gap-4">
                {r.insights.map((ins) => (
                  <InsightCard key={ins.id} insight={ins} className="flex-1 basis-[30rem]" />
                ))}
              </div>
            </section>
          )}

          {/* ── Ritmo del mese + cosa è cambiato ─────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 xl:items-stretch">
            <Card className={`flex flex-col gap-5 ${hasNovelties ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-sm font-semibold text-(--ink)">Il ritmo del mese</h2>
                <div className="flex items-center gap-3 text-xs text-(--muted)">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2 rounded-full bg-(--muted)" aria-hidden />
                    Uscite
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2 rounded-full bg-(--brand)" aria-hidden />
                    Entrate
                  </span>
                </div>
              </div>
              <div className="relative h-[220px] xl:h-auto xl:flex-1 xl:min-h-[240px]">
                <div className="absolute inset-0">
                  <SpendingTrend data={r.daily} avgDailyMinor={r.avgDailyMinor} currency="EUR" />
                </div>
              </div>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-4 border-t border-(--border)">
              <div className="space-y-0.5">
                <dt className="text-xs font-medium text-(--muted)">Giorni senza spese</dt>
                <dd className="text-lg font-medium font-mono tabular-nums tracking-tight text-(--ink)">
                  {r.patterns.noSpendDays}
                  {r.patterns.typicalNoSpendDays !== null && (
                    <span className="text-xs text-(--muted) font-sans font-normal ml-1.5">tipico {r.patterns.typicalNoSpendDays}</span>
                  )}
                </dd>
              </div>
              {r.patterns.topDay && (
                <div className="space-y-0.5">
                  <dt className="text-xs font-medium text-(--muted)">Giorno più caro</dt>
                  <dd className="text-lg font-medium font-mono tabular-nums tracking-tight text-(--ink)">
                    {r.patterns.topDay.day}
                    <span className="text-xs text-(--muted) font-sans font-normal ml-1.5">{fmtEur(r.patterns.topDay.totalMinor)}</span>
                  </dd>
                  {r.patterns.topDay.topTxn && (
                    <dd className="text-xs text-(--muted) truncate">{r.patterns.topDay.topTxn.label}</dd>
                  )}
                </div>
              )}
              {r.patterns.weekendSharePct !== null && (
                <div className="space-y-0.5">
                  <dt className="text-xs font-medium text-(--muted)">Quota weekend</dt>
                  <dd className="text-lg font-medium font-mono tabular-nums tracking-tight text-(--ink)">
                    {r.patterns.weekendSharePct.toLocaleString('it-IT')}%
                    {r.patterns.typicalWeekendSharePct !== null && (
                      <span className="text-xs text-(--muted) font-sans font-normal ml-1.5">tipico {r.patterns.typicalWeekendSharePct.toLocaleString('it-IT')}%</span>
                    )}
                  </dd>
                </div>
              )}
              {r.patterns.committedMinor > 0 && (
                <div className="space-y-0.5">
                  <dt className="text-xs font-medium text-(--muted)">Vincolate / libere</dt>
                  <dd className="text-lg font-medium font-mono tabular-nums tracking-tight text-(--ink)">
                    {pctOf(r.patterns.committedMinor, r.totalOutflowMinor)}%
                    <span className="text-xs text-(--muted) font-sans font-normal ml-1.5">{fmtEur(r.patterns.committedMinor)} fisse</span>
                  </dd>
                </div>
              )}
            </dl>
            </Card>

            {hasNovelties && (
              <Card className="space-y-5">
                <h2 className="text-sm font-semibold text-(--ink)">Cosa è cambiato</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-1 gap-6">
                {r.newMerchants.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium text-(--muted)">Mai visti prima</h3>
                    <ul className="divide-y divide-(--border)">
                      {r.newMerchants.map((m) => (
                        <li key={m.label} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                          <span className="text-(--ink) truncate">{m.label}</span>
                          <span className="font-mono tabular-nums text-(--ink) shrink-0">
                            {fmtEur(m.totalMinor)}
                            <span className="text-(--muted) font-sans text-xs ml-1">×{m.count}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.ceased.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium text-(--muted)">Spariti questo mese</h3>
                    <ul className="divide-y divide-(--border)">
                      {r.ceased.map((c) => (
                        <li key={c.label} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                          <span className="text-(--ink) truncate">{c.label}</span>
                          <span className="font-mono tabular-nums text-(--ink) shrink-0">−{fmtEur(c.monthlyMinor)}/mese</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.priceMoves.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium text-(--muted)">Scontrino cambiato</h3>
                    <ul className="divide-y divide-(--border)">
                      {r.priceMoves.map((p) => (
                        <li key={p.label} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                          <span className="min-w-0">
                            <span className="block text-(--ink) truncate">{p.label}</span>
                            <span className="block text-xs text-(--muted) font-mono tabular-nums">
                              {fmtEur(p.baseMedianMinor, 2)} → {fmtEur(p.monthMedianMinor, 2)}
                            </span>
                          </span>
                          <Badge variant={p.deltaPct > 0 ? 'loss' : 'gain'}>
                            {p.deltaPct > 0 ? '+' : ''}{p.deltaPct.toLocaleString('it-IT')}%
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              </Card>
            )}
          </div>

          {/* ── Categorie + esercenti, con drill-down ────────────────────────── */}
          <div className="grid grid-cols-1 2xl:grid-cols-5 gap-6 2xl:items-stretch">
            <Card className="space-y-4 2xl:col-span-2">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-(--ink)">Dove sono andati i soldi</h2>
                <p className="text-xs text-(--muted)">
                  Ogni categoria si apre sulle transazioni che la compongono. Il confronto è con la
                  mediana degli ultimi {r.baseline.monthsInBaseline > 0 ? r.baseline.monthsInBaseline : 6} mesi.
                </p>
              </div>
              {r.categories.length === 0 ? (
                <p className="text-sm text-(--muted)">Nessuna uscita registrata.</p>
              ) : (
                <div className="divide-y divide-(--border)">
                  {r.categories.map((cat) => (
                    <CategoryRow key={cat.categoryId ?? 'none'} cat={cat} totalOutflow={r.totalOutflowMinor} />
                  ))}
                </div>
              )}
            </Card>

            <Card className="space-y-4 2xl:col-span-3">
              <h2 className="text-sm font-semibold text-(--ink)">Top esercenti</h2>
              {r.merchants.length === 0 ? (
                <p className="text-sm text-(--muted)">Nessuna uscita registrata.</p>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-10 items-start">
                  <div className="divide-y divide-(--border)">
                    {r.merchants.slice(0, merchantSplit).map((m, i) => (
                      <MerchantRow key={m.key} m={m} rank={i + 1} totalOutflow={r.totalOutflowMinor} />
                    ))}
                  </div>
                  <div className="divide-y divide-(--border) max-xl:border-t max-xl:border-(--border) max-xl:pt-2.5">
                    {r.merchants.slice(merchantSplit).map((m, i) => (
                      <MerchantRow key={m.key} m={m} rank={merchantSplit + i + 1} totalOutflow={r.totalOutflowMinor} />
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* ── Qualità dei dati ─────────────────────────────────────────────── */}
          {r.uncategorized.count > 0 && (
            <Card className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-(--ink)">
                  {r.uncategorized.count} movimenti senza categoria
                  <span className="text-(--muted) font-normal"> · {fmtEur(r.uncategorized.totalMinor)}</span>
                </p>
                <p className="text-xs text-(--muted)">
                  Categorizzarli rende più affidabili confronti e considerazioni.
                </p>
              </div>
              <Link
                href={accountId !== null ? `/dashboard/accounts/${accountId}` : '/dashboard/accounts'}
                className="shrink-0 inline-flex items-center gap-1.5 text-xs text-(--brand-text) hover:underline"
              >
                Sistemali dal conto →
              </Link>
            </Card>
          )}
        </>
      )}
    </main>
    </>
  )
}
