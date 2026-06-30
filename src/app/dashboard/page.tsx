import { requireUser } from '@/lib/dal'
import { listInstitutions } from '@/lib/institutions'
import AddInstitutionForm from './AddInstitutionForm'
import NetWorthChart from './NetWorthChart'
import { ensureTodaySnapshot, listSnapshots } from '@/lib/valuation'
import { Breadcrumb } from '@/components/ui'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<string, string> = {
  bank: 'Banca',
  broker: 'Broker',
  both: 'Banca + Broker',
}

function formatEur(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
  })
}

export default async function DashboardPage() {
  const user = await requireUser()
  const institutions = listInstitutions(user.id)

  await ensureTodaySnapshot(user.id).catch(() => {})

  const snapshots = listSnapshots(user.id)
  const latest    = snapshots.at(-1) ?? null

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-8">
      <Breadcrumb items={[{ label: 'Dashboard' }]} />

      {/* ── Net worth card ── */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-400 mb-1">Net worth totale (EUR)</p>
            {latest ? (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-zinc-100 font-mono tabular-nums">
                  {formatEur(latest.net_worth_eur_minor)}
                </span>
                {latest.stale === 1 && (
                  <span className="text-xs text-amber-400 bg-amber-950 px-1.5 py-0.5 rounded">
                    parziale
                  </span>
                )}
              </div>
            ) : (
              <span className="text-zinc-500 text-sm">Calcolo in corso…</span>
            )}
          </div>

          {latest && (
            <div className="text-right text-sm text-zinc-400 space-y-1">
              <p>
                Investimenti:{' '}
                <span className="text-zinc-200 font-medium font-mono tabular-nums">
                  {formatEur(latest.investments_eur_minor)}
                </span>
              </p>
              <p>
                Conti:{' '}
                <span className="text-zinc-200 font-medium font-mono tabular-nums">
                  {formatEur(latest.accounts_eur_minor)}
                </span>
              </p>
              <p className="text-xs text-zinc-600">
                Aggiornato {latest.date}
              </p>
            </div>
          )}
        </div>

        <NetWorthChart snapshots={snapshots} />
      </section>

      {/* ── Institutions list ── */}
      <section className="space-y-4">
        <h1 className="text-lg font-semibold text-zinc-100">Istituzioni</h1>
        <AddInstitutionForm />

        {institutions.length === 0 ? (
          <p className="text-sm text-zinc-500 py-6 text-center border border-dashed border-zinc-800 rounded-xl">
            Nessuna istituzione. Aggiungine una per iniziare.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 overflow-hidden">
            {institutions.map((inst) => (
              <li key={inst.id} className="bg-zinc-900">
                <Link
                  href={`/dashboard/institutions/${inst.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800 transition"
                >
                  <span className="text-zinc-100">{inst.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">{KIND_LABEL[inst.kind] ?? inst.kind}</span>
                    <ChevronRight className="size-4 text-zinc-600" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
