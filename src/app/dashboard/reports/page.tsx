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
import type { InsightIcon, InsightSeverity } from '@/lib/insights'
import {
  FileBarChart2, TrendingUp, Repeat2, AlertCircle, PiggyBank,
  Calendar, Scale, Coins, Sparkles, ChevronDown, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import { Breadcrumb, Card, EmptyState, Badge, Button } from '@/components/ui'
import SpendingTrend from './SpendingTrend'
import MonthNav from './MonthNav'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ month?: string; account?: string }>
}

// ── Formattazione ─────────────────────────────────────────────────────────────

function fmtEur(minor: number, decimals = 0): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency', currency: 'EUR',
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
    <Badge variant={up ? 'loss' : 'gain'}>
      {up ? <ArrowUpRight className="size-3" strokeWidth={2} aria-hidden /> : <ArrowDownRight className="size-3" strokeWidth={2} aria-hidden />}
      {up ? '+' : '−'}{Math.abs(pct)}%
    </Badge>
  )
}

// ── Considerazioni del mese ───────────────────────────────────────────────────

const INSIGHT_ICONS: Record<InsightIcon, React.ElementType> = {
  trend: TrendingUp, repeat: Repeat2, alert: AlertCircle,
  piggy: PiggyBank, calendar: Calendar, scale: Scale, coins: Coins,
}

const SEVERITY_META: Record<InsightSeverity, {
  tile: string
  badge: 'danger' | 'warning' | 'gain' | 'neutral'
  label: string
}> = {
  critical:    { tile: 'bg-[--danger-subtle] text-[--danger]',   badge: 'danger',  label: 'Critico'     },
  warn:        { tile: 'bg-[--warning-subtle] text-[--warning-text]', badge: 'warning', label: 'Attenzione'  },
  opportunity: { tile: 'bg-[--brand-subtle] text-[--brand-text]', badge: 'gain',    label: 'Opportunità' },
  info:        { tile: 'bg-[--surface-2] text-[--muted]',        badge: 'neutral', label: 'Info'        },
}

// ── Righe espandibili (drill-down nativo, accessibile da tastiera) ────────────

function TxnList({ txns }: { txns: MonthTxn[] }) {
  return (
    <ul className="mt-2 divide-y divide-[--border] border-t border-[--border]">
      {txns.map((t) => (
        <li key={t.id} className="flex items-baseline gap-3 py-2 text-sm">
          <span className="text-xs text-[--faint] tabular-nums w-12 shrink-0">{fmtDate(t.booked_date)}</span>
          <span className="text-[--ink] truncate flex-1 min-w-0">{t.label}</span>
          <span className="font-mono tabular-nums text-[--ink] shrink-0">{fmtEur(t.amountMinor, 2)}</span>
        </li>
      ))}
    </ul>
  )
}

function CategoryRow({ cat, totalOutflow }: { cat: MonthCategoryRow; totalOutflow: number }) {
  const barPct = pctOf(cat.totalMinor, totalOutflow)
  const color  = cat.color ?? 'var(--faint)'
  return (
    <details className="group py-2.5 first:pt-0 last:pb-0">
      <summary className="flex items-center gap-3 cursor-pointer list-none rounded-lg -mx-2 px-2 py-1 hover:bg-[--surface-2] transition-colors duration-150 [&::-webkit-details-marker]:hidden">
        <span className="size-2 rounded-full shrink-0" style={{ background: color }} aria-hidden />
        <span className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm text-[--ink] truncate">{cat.categoryName}</span>
          {cat.deltaMinor !== null && cat.typicalMinor !== null && Math.abs(cat.deltaMinor) >= 1000 && (
            <DeltaBadge deltaMinor={cat.deltaMinor} baseMinor={cat.typicalMinor} />
          )}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-[--muted] flex items-center gap-1.5">
          <span className="text-[--ink] text-sm font-medium">{fmtEur(cat.totalMinor)}</span>
          <span className="text-[--faint]">{barPct}%</span>
          <span className="text-[--faint]">· {cat.count}×</span>
        </span>
        <ChevronDown className="size-4 text-[--faint] shrink-0 transition-transform duration-150 group-open:rotate-180" strokeWidth={1.75} aria-hidden />
      </summary>
      <div className="h-1.5 bg-[--surface-2] rounded-full overflow-hidden mt-2" aria-hidden>
        <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: color }} />
      </div>
      {cat.typicalMinor !== null && (
        <p className="text-xs text-[--faint] mt-2">
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
    <details className="group py-2.5 first:pt-0 last:pb-0">
      <summary className="flex items-center gap-3 cursor-pointer list-none rounded-lg -mx-2 px-2 py-1 hover:bg-[--surface-2] transition-colors duration-150 [&::-webkit-details-marker]:hidden">
        <span className="text-xs tabular-nums text-[--faint] w-5 shrink-0 text-right">{rank}</span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-sm text-[--ink] truncate">{m.label}</span>
            {m.isNew && <Badge variant="info">nuovo</Badge>}
          </span>
          {m.categoryName && <span className="block text-xs text-[--faint]">{m.categoryName}</span>}
        </span>
        <span className="hidden sm:block w-24 h-1 bg-[--surface-2] rounded-full overflow-hidden shrink-0" aria-hidden>
          <span className="block h-full bg-[--danger]/50 rounded-full" style={{ width: `${barPct}%` }} />
        </span>
        <span className="text-right shrink-0">
          <span className="block text-sm font-medium tabular-nums text-[--ink]">{fmtEur(m.totalMinor)}</span>
          <span className="block text-xs text-[--faint]">×{m.count}</span>
        </span>
        <ChevronDown className="size-4 text-[--faint] shrink-0 transition-transform duration-150 group-open:rotate-180" strokeWidth={1.75} aria-hidden />
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
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Report' }]} />
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
  const toneColor = r.verdict?.tone === 'bad' ? 'text-[--danger]'
    : r.verdict?.tone === 'good' ? 'text-[--brand-text]'
    : 'text-[--ink]'

  const hasNovelties = r.newMerchants.length > 0 || r.ceased.length > 0 || r.priceMoves.length > 0

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Report' }]} />

      {/* ── Testata: mese + filtri ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-[--ink] [text-wrap:balance]">
            {cap(monthLabelIt(r.month))}
          </h1>
          <p className="text-sm text-[--muted] mt-0.5">
            {r.isPartialMonth
              ? `Mese in corso · dati fino al giorno ${r.daysElapsed}`
              : `Report del mese · ${r.txCount} movimenti`}
          </p>
        </div>
        <MonthNav months={months} month={r.month} accounts={accounts} accountId={accountId} />
      </div>

      {!r.hasData ? (
        <EmptyState
          icon={FileBarChart2}
          title="Nessun movimento in questo mese"
          description="Prova un altro mese o un altro conto."
        />
      ) : (
        <>
          {/* ── Verdetto: la risposta in 5 secondi ───────────────────────────── */}
          <Card className="space-y-5">
            {r.verdict && (
              <div className="space-y-1.5">
                <p className={`text-lg font-semibold leading-snug [text-wrap:balance] ${toneColor}`}>
                  {r.verdict.headline}
                </p>
                {r.verdict.detail && (
                  <p className="text-sm text-[--muted] max-w-[75ch]">{r.verdict.detail}</p>
                )}
              </div>
            )}

            {(r.ranking || r.baseline.prevMonthOutflowMinor !== null || r.baseline.yoyOutflowMinor !== null) && (
              <div className="flex items-center gap-2 flex-wrap text-xs text-[--muted]">
                {r.ranking && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-[--surface-2] px-2 py-1">
                    <Sparkles className="size-3.5 text-[--faint]" strokeWidth={1.75} aria-hidden />
                    {r.ranking.rank}° mese più costoso degli ultimi {r.ranking.monthsCompared}
                  </span>
                )}
                {r.baseline.prevMonthOutflowMinor !== null && r.baseline.prevMonth && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-[--surface-2] px-2 py-1">
                    vs {monthLabelIt(r.baseline.prevMonth).split(' ')[0]}
                    <DeltaBadge
                      deltaMinor={r.totalOutflowMinor - r.baseline.prevMonthOutflowMinor}
                      baseMinor={r.baseline.prevMonthOutflowMinor}
                    />
                  </span>
                )}
                {r.baseline.yoyOutflowMinor !== null && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-[--surface-2] px-2 py-1">
                    vs un anno fa
                    <DeltaBadge
                      deltaMinor={r.totalOutflowMinor - r.baseline.yoyOutflowMinor}
                      baseMinor={r.baseline.yoyOutflowMinor}
                    />
                  </span>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-4 border-t border-[--border]">
              <div className="space-y-1">
                <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">Uscite</p>
                <div className="flex items-end gap-2 flex-wrap">
                  <p className="text-xl font-semibold font-mono tabular-nums text-[--danger] leading-none">
                    {fmtEur(r.totalOutflowMinor)}
                  </p>
                  {r.baseline.typicalOutflowMinor !== null && !r.isPartialMonth && (
                    <DeltaBadge
                      deltaMinor={r.totalOutflowMinor - r.baseline.typicalOutflowMinor}
                      baseMinor={r.baseline.typicalOutflowMinor}
                    />
                  )}
                </div>
                {r.baseline.typicalOutflowMinor !== null && (
                  <p className="text-xs text-[--faint]">tipico {fmtEur(r.baseline.typicalOutflowMinor)}</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">Entrate</p>
                <p className="text-xl font-semibold font-mono tabular-nums text-[--brand-text] leading-none">
                  +{fmtEur(r.totalInflowMinor)}
                </p>
                {r.baseline.typicalInflowMinor !== null && (
                  <p className="text-xs text-[--faint]">tipico {fmtEur(r.baseline.typicalInflowMinor)}</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">Saldo netto</p>
                <p className={[
                  'text-xl font-semibold font-mono tabular-nums leading-none',
                  r.netMinor >= 0 ? 'text-[--brand-text]' : 'text-[--danger]',
                ].join(' ')}>
                  {r.netMinor >= 0 ? '+' : ''}{fmtEur(r.netMinor)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">Media al giorno</p>
                <p className="text-xl font-semibold font-mono tabular-nums text-[--ink] leading-none">
                  {fmtEur(r.avgDailyMinor)}
                </p>
                <p className="text-xs text-[--faint]">
                  su {r.daysElapsed} giorni{r.isPartialMonth ? ' trascorsi' : ''}
                </p>
              </div>
            </div>

            {r.transfersOutMinor > 0 && (
              <p className="text-xs text-[--faint]">
                Trasferimenti tra conti propri esclusi: {fmtEur(r.transfersOutMinor)} in uscita
                (non sono spesa: il patrimonio non cambia).
              </p>
            )}
          </Card>

          {/* ── Considerazioni del mese ──────────────────────────────────────── */}
          {r.insights.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-[--ink]">Cosa è successo di notevole</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {r.insights.map((ins) => {
                  const meta = SEVERITY_META[ins.severity]
                  const Icon = INSIGHT_ICONS[ins.icon]
                  return (
                    <Card key={ins.id} className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${meta.tile}`}>
                            <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                          </span>
                          <h3 className="text-sm font-semibold text-[--ink] truncate">{ins.title}</h3>
                        </div>
                        <Badge variant={meta.badge} className="shrink-0">{meta.label}</Badge>
                      </div>
                      <p className="text-sm text-[--muted] leading-relaxed">{ins.body}</p>
                      {ins.impactLabel && (
                        <p className="text-xs font-medium font-mono tabular-nums text-[--ink] bg-[--surface-2] rounded-md px-2 py-1 w-fit">
                          {ins.impactLabel}
                        </p>
                      )}
                    </Card>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── Andamento del mese + pattern ─────────────────────────────────── */}
          <Card className="space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-sm font-semibold text-[--ink]">Il ritmo del mese</h2>
              <div className="flex items-center gap-3 text-xs text-[--muted]">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-full bg-[--danger]" aria-hidden />
                  Uscite
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-full bg-[--brand-text]" aria-hidden />
                  Entrate
                </span>
              </div>
            </div>
            <SpendingTrend data={r.daily} avgDailyMinor={r.avgDailyMinor} currency="EUR" />
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-4 border-t border-[--border]">
              <div className="space-y-0.5">
                <dt className="text-xs font-medium text-[--muted] uppercase tracking-wide">Giorni senza spese</dt>
                <dd className="text-lg font-semibold font-mono tabular-nums text-[--ink]">
                  {r.patterns.noSpendDays}
                  {r.patterns.typicalNoSpendDays !== null && (
                    <span className="text-xs text-[--faint] font-sans font-normal ml-1.5">tipico {r.patterns.typicalNoSpendDays}</span>
                  )}
                </dd>
              </div>
              {r.patterns.topDay && (
                <div className="space-y-0.5">
                  <dt className="text-xs font-medium text-[--muted] uppercase tracking-wide">Giorno più caro</dt>
                  <dd className="text-lg font-semibold font-mono tabular-nums text-[--ink]">
                    {r.patterns.topDay.day}
                    <span className="text-xs text-[--faint] font-sans font-normal ml-1.5">{fmtEur(r.patterns.topDay.totalMinor)}</span>
                  </dd>
                  {r.patterns.topDay.topTxn && (
                    <dd className="text-xs text-[--faint] truncate">{r.patterns.topDay.topTxn.label}</dd>
                  )}
                </div>
              )}
              {r.patterns.weekendSharePct !== null && (
                <div className="space-y-0.5">
                  <dt className="text-xs font-medium text-[--muted] uppercase tracking-wide">Quota weekend</dt>
                  <dd className="text-lg font-semibold font-mono tabular-nums text-[--ink]">
                    {r.patterns.weekendSharePct.toLocaleString('it-IT')}%
                    {r.patterns.typicalWeekendSharePct !== null && (
                      <span className="text-xs text-[--faint] font-sans font-normal ml-1.5">tipico {r.patterns.typicalWeekendSharePct.toLocaleString('it-IT')}%</span>
                    )}
                  </dd>
                </div>
              )}
              {r.patterns.committedMinor > 0 && (
                <div className="space-y-0.5">
                  <dt className="text-xs font-medium text-[--muted] uppercase tracking-wide">Vincolate / libere</dt>
                  <dd className="text-lg font-semibold font-mono tabular-nums text-[--ink]">
                    {pctOf(r.patterns.committedMinor, r.totalOutflowMinor)}%
                    <span className="text-xs text-[--faint] font-sans font-normal ml-1.5">{fmtEur(r.patterns.committedMinor)} fisse</span>
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {/* ── Categorie con drill-down ─────────────────────────────────────── */}
          <Card className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-[--ink]">Dove sono andati i soldi</h2>
              <p className="text-xs text-[--muted]">
                Ogni categoria si apre sulle transazioni che la compongono. Il confronto è con la
                mediana degli ultimi {r.baseline.monthsInBaseline > 0 ? r.baseline.monthsInBaseline : 6} mesi.
              </p>
            </div>
            {r.categories.length === 0 ? (
              <p className="text-sm text-[--faint]">Nessuna uscita registrata.</p>
            ) : (
              <div className="divide-y divide-[--border]">
                {r.categories.map((cat) => (
                  <CategoryRow key={cat.categoryId ?? 'none'} cat={cat} totalOutflow={r.totalOutflowMinor} />
                ))}
              </div>
            )}
          </Card>

          {/* ── Novità e cambi prezzo ────────────────────────────────────────── */}
          {hasNovelties && (
            <Card className="space-y-5">
              <h2 className="text-sm font-semibold text-[--ink]">Cosa è cambiato</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {r.newMerchants.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium text-[--muted] uppercase tracking-wide">Mai visti prima</h3>
                    <ul className="divide-y divide-[--border]">
                      {r.newMerchants.map((m) => (
                        <li key={m.label} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                          <span className="text-[--ink] truncate">{m.label}</span>
                          <span className="font-mono tabular-nums text-[--ink] shrink-0">
                            {fmtEur(m.totalMinor)}
                            <span className="text-[--faint] font-sans text-xs ml-1">×{m.count}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.ceased.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium text-[--muted] uppercase tracking-wide">Spariti questo mese</h3>
                    <ul className="divide-y divide-[--border]">
                      {r.ceased.map((c) => (
                        <li key={c.label} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                          <span className="text-[--ink] truncate">{c.label}</span>
                          <span className="font-mono tabular-nums text-[--brand-text] shrink-0">−{fmtEur(c.monthlyMinor)}/mese</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.priceMoves.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium text-[--muted] uppercase tracking-wide">Scontrino cambiato</h3>
                    <ul className="divide-y divide-[--border]">
                      {r.priceMoves.map((p) => (
                        <li key={p.label} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                          <span className="min-w-0">
                            <span className="block text-[--ink] truncate">{p.label}</span>
                            <span className="block text-xs text-[--faint] tabular-nums">
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

          {/* ── Top esercenti ────────────────────────────────────────────────── */}
          <Card className="space-y-4">
            <h2 className="text-sm font-semibold text-[--ink]">Top esercenti</h2>
            {r.merchants.length === 0 ? (
              <p className="text-sm text-[--faint]">Nessuna uscita registrata.</p>
            ) : (
              <div className="divide-y divide-[--border]">
                {r.merchants.map((m, i) => (
                  <MerchantRow key={m.key} m={m} rank={i + 1} totalOutflow={r.totalOutflowMinor} />
                ))}
              </div>
            )}
          </Card>

          {/* ── Qualità dei dati ─────────────────────────────────────────────── */}
          {r.uncategorized.count > 0 && (
            <Card className="flex items-center justify-between gap-4 flex-wrap">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-[--ink]">
                  {r.uncategorized.count} movimenti senza categoria
                  <span className="text-[--muted] font-normal"> · {fmtEur(r.uncategorized.totalMinor)}</span>
                </p>
                <p className="text-xs text-[--muted]">
                  Categorizzarli rende più affidabili confronti e considerazioni.
                </p>
              </div>
              <Link
                href={accountId !== null ? `/dashboard/accounts/${accountId}` : '/dashboard/accounts'}
                className="shrink-0 inline-flex items-center gap-1.5 text-xs text-[--brand-text] hover:underline"
              >
                Sistemali dal conto →
              </Link>
            </Card>
          )}
        </>
      )}
    </main>
  )
}
