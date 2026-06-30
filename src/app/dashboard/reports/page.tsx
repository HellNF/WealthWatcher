import Link from 'next/link'
import { requireUser } from '@/lib/dal'
import { listAccounts } from '@/lib/accounts'
import { monthlyReport, availableMonths } from '@/lib/reports'
import { fromMinor, formatMoney } from '@/lib/money'
import { FileBarChart2 } from 'lucide-react'
import {
  Breadcrumb, Card, EmptyState,
  TableWrapper, Table, TableBody, Tr, Td,
} from '@/components/ui'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ month?: string; account?: string }>
}

function MonthLabel(m: string): string {
  const [y, mo] = m.split('-')
  const months = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
  return `${months[parseInt(mo, 10) - 1]} ${y}`
}

function pct(part: number, total: number): number {
  if (total === 0) return 0
  return Math.round((part / total) * 100)
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
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

export default async function ReportsPage({ searchParams }: Props) {
  const { month: monthParam, account: accountParam } = await searchParams
  const user = await requireUser()

  const accounts = listAccounts(user.id)
  const accountId = accountParam ? parseInt(accountParam, 10) : undefined

  const months = availableMonths(user.id, accountId)
  const month = monthParam ?? months[0]

  const report = month ? monthlyReport(user.id, month, accountId) : null

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-8">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Report mensile' },
      ]} />

      {/* Filtri */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[--muted] whitespace-nowrap w-10 shrink-0">Conto</span>
          <div className="flex gap-0.5 flex-wrap p-1 bg-[--surface-2] rounded-xl">
            <FilterPill
              href={`/dashboard/reports${month ? `?month=${month}` : ''}`}
              active={!accountId}
            >
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
            <span className="text-xs text-[--muted] whitespace-nowrap w-10 shrink-0">Mese</span>
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
          description="Importa movimenti da un conto bancario per visualizzare il report mensile."
        />
      ) : (
        <>
          {/* Totali */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <p className="text-xs font-medium text-[--muted] uppercase tracking-wide mb-1.5">Uscite</p>
              <p className="text-2xl font-semibold text-[--danger] tabular-nums font-mono leading-none">
                {formatMoney(report.totalOutflow, 'EUR')}
              </p>
            </Card>
            <Card>
              <p className="text-xs font-medium text-[--muted] uppercase tracking-wide mb-1.5">Entrate</p>
              <p className="text-2xl font-semibold text-[--brand] tabular-nums font-mono leading-none">
                +{formatMoney(report.totalInflow, 'EUR')}
              </p>
            </Card>
            <Card>
              <p className="text-xs font-medium text-[--muted] uppercase tracking-wide mb-1.5">Saldo periodo</p>
              <p className={[
                'text-2xl font-semibold tabular-nums font-mono leading-none',
                report.totalOutflow + report.totalInflow >= 0 ? 'text-[--brand]' : 'text-[--danger]',
              ].join(' ')}>
                {report.totalOutflow + report.totalInflow >= 0 ? '+' : ''}
                {fromMinor(report.totalOutflow + report.totalInflow, 'EUR')}
              </p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Per categoria */}
            <Card>
              <h2 className="text-sm font-semibold text-[--ink] mb-4">Per categoria</h2>
              {report.byCategory.length === 0 ? (
                <p className="text-sm text-[--faint]">Nessuna uscita</p>
              ) : (
                <div className="space-y-3.5">
                  {report.byCategory.map((cat, i) => {
                    const abs = Math.abs(cat.total_minor)
                    const totalAbs = Math.abs(report.totalOutflow)
                    return (
                      <div key={i}>
                        <div className="flex justify-between items-baseline text-sm mb-1.5">
                          <span className="text-[--ink] truncate mr-2">
                            {cat.category_name ?? 'Senza categoria'}
                          </span>
                          <span className="text-[--danger] tabular-nums font-mono text-xs shrink-0">
                            {fromMinor(cat.total_minor, 'EUR')}
                            <span className="text-[--faint] ml-1">·&thinsp;{pct(abs, totalAbs)}%</span>
                          </span>
                        </div>
                        <div className="h-1.5 bg-[--surface-2] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[--danger]/60 rounded-full transition-all duration-500"
                            style={{ width: `${pct(abs, totalAbs)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {/* Top merchant */}
            <Card noPadding>
              <h2 className="text-sm font-semibold text-[--ink] px-5 pt-5 pb-3">Top merchant</h2>
              {report.byMerchant.length === 0 ? (
                <p className="text-sm text-[--faint] px-5 pb-5">Nessuna uscita</p>
              ) : (
                <TableWrapper>
                  <Table>
                    <TableBody>
                      {report.byMerchant.map((m, i) => (
                        <Tr key={i}>
                          <Td className="text-[--ink]">
                            {m.merchant_name ?? (
                              <span className="text-[--faint] italic">sconosciuto</span>
                            )}
                          </Td>
                          <Td className="text-[--muted] text-xs">
                            {m.category_name ?? '—'}
                          </Td>
                          <Td className="text-[--faint] text-xs tabular-nums">
                            ×{m.count}
                          </Td>
                          <Td numeric className="text-[--danger] text-xs">
                            {fromMinor(m.total_minor, 'EUR')}
                          </Td>
                        </Tr>
                      ))}
                    </TableBody>
                  </Table>
                </TableWrapper>
              )}
            </Card>
          </div>
        </>
      )}
    </main>
  )
}
