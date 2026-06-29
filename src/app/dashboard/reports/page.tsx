import Link from 'next/link'
import { requireUser } from '@/lib/dal'
import { listAccounts } from '@/lib/accounts'
import { monthlyReport, availableMonths } from '@/lib/reports'
import { fromMinor, formatMoney } from '@/lib/money'

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

export default async function ReportsPage({ searchParams }: Props) {
  const { month: monthParam, account: accountParam } = await searchParams
  const user = await requireUser()

  const accounts = listAccounts(user.id)
  const accountId = accountParam ? parseInt(accountParam, 10) : undefined

  const months = availableMonths(user.id, accountId)
  const month = monthParam ?? months[0]

  const report = month ? monthlyReport(user.id, month, accountId) : null

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3 text-sm">
          <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-200 transition">
            ← Dashboard
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="font-semibold text-zinc-100">Report mensile</span>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 space-y-8">
        {/* Filters */}
        <section className="flex flex-wrap gap-4 items-center">
          {/* Account selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500 whitespace-nowrap">Conto</label>
            <div className="flex gap-1 flex-wrap">
              <Link
                href={`/dashboard/reports${month ? `?month=${month}` : ''}`}
                className={`px-3 py-1 rounded-lg text-sm transition ${
                  !accountId
                    ? 'bg-zinc-100 text-zinc-950 font-medium'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Tutti
              </Link>
              {accounts.map((acc) => (
                <Link
                  key={acc.id}
                  href={`/dashboard/reports?account=${acc.id}${month ? `&month=${month}` : ''}`}
                  className={`px-3 py-1 rounded-lg text-sm transition ${
                    accountId === acc.id
                      ? 'bg-zinc-100 text-zinc-950 font-medium'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {acc.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Month selector */}
          {months.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-500 whitespace-nowrap">Mese</label>
              <div className="flex gap-1 flex-wrap">
                {months.map((m) => (
                  <Link
                    key={m}
                    href={`/dashboard/reports?month=${m}${accountId ? `&account=${accountId}` : ''}`}
                    className={`px-3 py-1 rounded-lg text-sm transition ${
                      m === month
                        ? 'bg-zinc-100 text-zinc-950 font-medium'
                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {MonthLabel(m)}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        {!report || months.length === 0 ? (
          <p className="text-sm text-zinc-500 py-12 text-center border border-dashed border-zinc-800 rounded-xl">
            Nessun dato disponibile. Importa movimenti da un conto bancario.
          </p>
        ) : (
          <>
            {/* Totals */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-4">
                <p className="text-xs text-zinc-500 mb-1">Uscite</p>
                <p className="text-2xl font-semibold text-red-400 tabular-nums">
                  {formatMoney(report.totalOutflow, 'EUR')}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-4">
                <p className="text-xs text-zinc-500 mb-1">Entrate</p>
                <p className="text-2xl font-semibold text-emerald-400 tabular-nums">
                  +{formatMoney(report.totalInflow, 'EUR')}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-4">
                <p className="text-xs text-zinc-500 mb-1">Saldo periodo</p>
                <p
                  className={`text-2xl font-semibold tabular-nums ${
                    report.totalOutflow + report.totalInflow >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {report.totalOutflow + report.totalInflow >= 0 ? '+' : ''}
                  {fromMinor(report.totalOutflow + report.totalInflow, 'EUR')}
                </p>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* By category */}
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
                  Per categoria
                </h2>
                {report.byCategory.length === 0 ? (
                  <p className="text-sm text-zinc-600">Nessuna uscita</p>
                ) : (
                  <div className="space-y-1">
                    {report.byCategory.map((cat, i) => {
                      const abs = Math.abs(cat.total_minor)
                      const totalAbs = Math.abs(report.totalOutflow)
                      return (
                        <div key={i} className="group">
                          <div className="flex justify-between text-sm mb-0.5">
                            <span className="text-zinc-300">
                              {cat.category_name ?? 'Senza categoria'}
                            </span>
                            <span className="text-red-400 tabular-nums font-mono text-xs">
                              {fromMinor(cat.total_minor, 'EUR')} ({pct(abs, totalAbs)}%)
                            </span>
                          </div>
                          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-500/60 rounded-full transition-all"
                              style={{ width: `${pct(abs, totalAbs)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* By merchant */}
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
                  Per merchant (top 20)
                </h2>
                {report.byMerchant.length === 0 ? (
                  <p className="text-sm text-zinc-600">Nessuna uscita</p>
                ) : (
                  <div className="rounded-xl border border-zinc-800 overflow-hidden">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-zinc-800/50">
                        {report.byMerchant.map((m, i) => (
                          <tr key={i} className="bg-zinc-900 hover:bg-zinc-800/60 transition">
                            <td className="px-3 py-2 text-zinc-200">
                              {m.merchant_name ?? <span className="text-zinc-600 italic">sconosciuto</span>}
                            </td>
                            <td className="px-3 py-2 text-zinc-500 text-xs">
                              {m.category_name ?? '—'}
                            </td>
                            <td className="px-3 py-2 text-right text-xs text-zinc-500 tabular-nums">
                              ×{m.count}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-mono text-red-400 text-xs">
                              {fromMinor(m.total_minor, 'EUR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
