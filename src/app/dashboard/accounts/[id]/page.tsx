import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getAccountForUser } from '@/lib/accounts'
import { getInstitutionForUser } from '@/lib/institutions'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AccountPage({ params }: Props) {
  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (isNaN(id)) notFound()

  const user = await requireUser()
  const account = getAccountForUser(user.id, id)
  if (!account) notFound()

  const institution = getInstitutionForUser(user.id, account.institution_id)

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3 text-sm">
          <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-200 transition">
            ← Dashboard
          </Link>
          <span className="text-zinc-700">/</span>
          {institution && (
            <>
              <Link
                href={`/dashboard/institutions/${institution.id}`}
                className="text-zinc-500 hover:text-zinc-200 transition"
              >
                {institution.name}
              </Link>
              <span className="text-zinc-700">/</span>
            </>
          )}
          <span className="font-semibold text-zinc-100">{account.name}</span>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 space-y-8">
        {/* Quick stats */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
            <p className="text-xs text-zinc-500 mb-1">Valuta</p>
            <p className="text-lg font-semibold text-zinc-100">{account.currency}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
            <p className="text-xs text-zinc-500 mb-1">Movimenti</p>
            <p className="text-lg font-semibold text-zinc-100">—</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
            <p className="text-xs text-zinc-500 mb-1">Ultimo import</p>
            <p className="text-lg font-semibold text-zinc-100">—</p>
          </div>
        </section>

        {/* Actions */}
        <section className="flex gap-3">
          <Link
            href={`/dashboard/accounts/${id}/import`}
            className="rounded-lg bg-emerald-500 text-zinc-950 font-medium px-4 py-2 text-sm hover:bg-emerald-400 transition"
          >
            Importa CSV
          </Link>
          <Link
            href={`/dashboard/reports?account=${id}`}
            className="rounded-lg border border-zinc-700 text-zinc-300 px-4 py-2 text-sm hover:border-zinc-500 hover:text-zinc-100 transition"
          >
            Report mensile
          </Link>
        </section>

        {/* Transactions placeholder — filled in Fase C */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
            Ultimi movimenti
          </h2>
          <p className="text-sm text-zinc-500 py-6 text-center border border-dashed border-zinc-800 rounded-xl">
            Nessun movimento. Importa un CSV per iniziare.
          </p>
        </section>
      </main>
    </div>
  )
}
