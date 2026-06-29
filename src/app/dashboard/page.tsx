import Link from 'next/link'
import { requireUser } from '@/lib/dal'
import { listInstitutions } from '@/lib/institutions'
import { signOutAction } from './actions'
import AddInstitutionForm from './AddInstitutionForm'

export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<string, string> = {
  bank: 'Banca',
  broker: 'Broker',
  both: 'Banca + Broker',
}

export default async function DashboardPage() {
  const user = await requireUser()
  const institutions = listInstitutions(user.id)

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-emerald-500 flex items-center justify-center text-sm font-bold text-zinc-950">
            W
          </div>
          <span className="font-semibold text-zinc-100">WealthWatcher</span>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-zinc-400">
              {user.name ?? user.email}
              {user.role === 'admin' && (
                <span className="ml-2 rounded bg-emerald-950 text-emerald-400 px-1.5 py-0.5 text-xs">
                  admin
                </span>
              )}
            </span>
            <form action={signOutAction}>
              <button className="text-zinc-500 hover:text-zinc-200 transition">Esci</button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 space-y-8">
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
                      <span className="text-zinc-600 text-xs">→</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
