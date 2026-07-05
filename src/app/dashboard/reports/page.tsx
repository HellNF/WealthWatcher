import Link from 'next/link'
import { requireUser } from '@/lib/dal'
import { listAccounts } from '@/lib/accounts'
import { monthlyReport, availableMonths } from '@/lib/reports'
import { fromMinor } from '@/lib/money'
import { FileBarChart2 } from 'lucide-react'
import {
  Breadcrumb, Card, EmptyState, Badge,
} from '@/components/ui'
import SpendingTrend from './SpendingTrend'
import CategoryDonut from './CategoryDonut'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ month?: string; account?: string }>
}

function MonthLabel(m: string): string {
  const [y, mo] = m.split('-')
  const months = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
  return `${months[parseInt(mo, 10) - 1]} ${y}`
}

function FilterPill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={[
        'px-3 py-1.5 rounded-lg text-sm transition-all duration-150 whitespace-nowrap',
        active
          ? 'bg-[--brand] text-[--brand-fg] font-medium shadow-sm'
          : 'text-[--muted] hover:text-[--ink]',
      ].join(' ')}
    >
      {children}
    </Link>
  )
}

function pct(part: number, total: number) {
  if (total === 0) return 0
  return Math.round((Math.abs(part) / Math.abs(total)) * 100)
}

export default async function ReportsPage({ searchParams }: Props) {
  const { month: monthParam, account: accountParam } = await searchParams
  const user = await requireUser()

  const accounts  = listAccounts(user.id)
  const accountId = accountParam ? parseInt(accountParam, 10) : undefined
  const months    = availableMonths(user.id, accountId)
  const month     = monthParam ?? months[0]
  const report    = month ? monthlyReport(user.id, month, accountId) : null

  const net        = report ? report.totalInflow + report.totalOutflow : 0
  const daysInData = report?.dailyTrend.length ?? 1
  const avgDaily   = report ? Math.round(Math.abs(report.totalOutflow) / Math.max(daysInData, 1)) : 0

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Report' },
      ]} />

      {/* ── Filtri ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[--muted] w-10 shrink-0">Conto</span>
          <div className="flex gap-0.5 flex-wrap p-1 bg-[--surface-2] rounded-xl">
            <FilterPill href={`/dashboard/reports${month ? `?month=${month}` : ''}`} active={!accountId}>
              Tutti
            </FilterPill>
            {accounts.map((acc) => (
              <FilterPill
                key={acc.id}
                href={`/dashboard/reports?account=${acc.id}${month ? `&month=${month}` : ''}`}
                active={accountId === acc.id}
              >
                {acc.name}
              </FilterPill>
            ))}
          </div>
        </div>

        {months.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[--muted] w-10 shrink-0">Mese</span>
            <div className="flex gap-0.5 flex-wrap p-1 bg-[--surface-2] rounded-xl">
              {months.map((m) => (
                <FilterPill
                  key={m}
                  href={`/dashboard/reports?month=${m}${accountId ? `&account=${accountId}` : ''}`}
                  active={m === month}
                >
                  {MonthLabel(m)}
                </FilterPill>
              ))}
            </div>
          </div>
        )}
      </div>

      {!report || months.length === 0 ? (
        <EmptyState
          icon={FileBarChart2}
          title="Nessun dato disponibile"
          description="Importa movimenti da un conto bancario per visualizzare il report."
        />
      ) : (
        <div className="space-y-6">

          {/* ── KPI hero ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="space-y-1">
              <p className="text-xs text-[--muted]">Uscite</p>
              <p className="text-xl font-semibold font-mono tabular-nums text-[--danger]">
                {fromMinor(report.totalOutflow, 'EUR')}
              </p>
            </Card>
            <Card className="space-y-1">
              <p className="text-xs text-[--muted]">Entrate</p>
              <p className="text-xl font-semibold font-mono tabular-nums text-[--brand-text]">
                +{fromMinor(report.totalInflow, 'EUR')}
              </p>
            </Card>
            <Card className="space-y-1">
              <p className="text-xs text-[--muted]">Saldo netto</p>
              <p className={[
                'text-xl font-semibold font-mono tabular-nums',
                net >= 0 ? 'text-[--brand-text]' : 'text-[--danger]',
              ].join(' ')}>
                {net >= 0 ? '+' : ''}{fromMinor(net, 'EUR')}
              </p>
            </Card>
            <Card className="space-y-1">
              <p className="text-xs text-[--muted]">Media / giorno</p>
              <p className="text-xl font-semibold font-mono tabular-nums text-[--ink]">
                {fromMinor(avgDaily, 'EUR')}
              </p>
              <p className="text-xs text-[--faint]">{report.txCount} movimenti</p>
            </Card>
          </div>

          {/* ── Trend giornaliero ─────────────────────────────────────────── */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[--ink]">Andamento del mese</h2>
              <div className="flex items-center gap-3 text-xs text-[--muted]">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-full bg-[--danger]" />
                  Uscite
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-full bg-[--brand-text]" />
                  Entrate
                </span>
              </div>
            </div>
            <SpendingTrend data={report.dailyTrend} currency="EUR" />
          </Card>

          {/* ── Categorie: donut + barre ───────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Donut */}
            <Card className="space-y-4">
              <h2 className="text-sm font-semibold text-[--ink]">Distribuzione spese</h2>
              {report.byCategory.length === 0 ? (
                <p className="text-sm text-[--faint]">Nessuna uscita registrata.</p>
              ) : (
                <CategoryDonut data={report.byCategory} currency="EUR" />
              )}
            </Card>

            {/* Barre per categoria */}
            <Card className="space-y-4">
              <h2 className="text-sm font-semibold text-[--ink]">Spese per categoria</h2>
              {report.byCategory.length === 0 ? (
                <p className="text-sm text-[--faint]">Nessuna uscita registrata.</p>
              ) : (
                <div className="space-y-3">
                  {report.byCategory.map((cat, i) => {
                    const abs      = Math.abs(cat.total_minor)
                    const totalAbs = Math.abs(report.totalOutflow)
                    const barPct   = pct(abs, totalAbs)
                    const color    = cat.color ?? '#6b7280'
                    return (
                      <div key={i} className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="flex items-center gap-2 truncate">
                            <span className="size-2 rounded-full shrink-0" style={{ background: color }} />
                            <span className="text-[--ink] truncate">{cat.category_name ?? 'Senza categoria'}</span>
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-[--muted] flex items-center gap-1.5">
                            <span className="text-[--ink] font-medium">{fromMinor(cat.total_minor, 'EUR')}</span>
                            <span className="text-[--faint]">{barPct}%</span>
                            <span className="text-[--faint]">· {cat.count}×</span>
                          </span>
                        </div>
                        <div className="h-1.5 bg-[--surface-2] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${barPct}%`, background: color }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* ── Top merchant ──────────────────────────────────────────────── */}
          <Card className="space-y-4">
            <h2 className="text-sm font-semibold text-[--ink]">Top merchant</h2>
            {report.byMerchant.length === 0 ? (
              <p className="text-sm text-[--faint]">Nessuna uscita registrata.</p>
            ) : (
              <div className="divide-y divide-[--border]">
                {report.byMerchant.slice(0, 12).map((m, i) => {
                  const totalAbs = Math.abs(report.totalOutflow)
                  const abs      = Math.abs(m.total_minor)
                  const barPct   = pct(abs, totalAbs)
                  return (
                    <div key={i} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      {/* Rank */}
                      <span className="text-xs tabular-nums text-[--faint] w-5 shrink-0 text-right">
                        {i + 1}
                      </span>
                      {/* Nome + categoria */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[--ink] truncate">
                          {m.merchant_name ?? <span className="text-[--faint] italic">Sconosciuto</span>}
                        </p>
                        {m.category_name && (
                          <p className="text-xs text-[--faint]">{m.category_name}</p>
                        )}
                      </div>
                      {/* Mini barra */}
                      <div className="hidden sm:block w-24 h-1 bg-[--surface-2] rounded-full overflow-hidden shrink-0">
                        <div
                          className="h-full bg-[--danger]/50 rounded-full"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      {/* Importo + conteggio */}
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium tabular-nums text-[--ink]">
                          {fromMinor(m.total_minor, 'EUR')}
                        </p>
                        <p className="text-xs text-[--faint]">×{m.count}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* ── Tabella movimenti non categorizzati ───────────────────────── */}
          {report.byCategory.some((c) => c.category_id === null) && (
            <Card className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[--ink]">Movimenti senza categoria</h2>
                <Badge variant="warning">
                  {report.byCategory.find((c) => c.category_id === null)?.count ?? 0}
                </Badge>
              </div>
              <p className="text-xs text-[--muted]">
                Alcuni movimenti non sono stati associati a una categoria. Controlla i merchant
                dalla pagina del conto per migliorare la classificazione futura.
              </p>
            </Card>
          )}

        </div>
      )}
    </main>
  )
}
