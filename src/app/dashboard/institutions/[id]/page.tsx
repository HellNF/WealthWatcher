import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getInstitutionForUser } from '@/lib/institutions'
import { listAccounts } from '@/lib/accounts'
import AddAccountForm from './AddAccountForm'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function InstitutionPage({ params }: Props) {
  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (isNaN(id)) notFound()

  const user = await requireUser()
  const institution = getInstitutionForUser(user.id, id)
  if (!institution) notFound()

  const accounts = listAccounts(user.id, id)

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-200 transition text-sm">
            ← Dashboard
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="font-semibold text-zinc-100">{institution.name}</span>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 space-y-8">
        <section className="space-y-4">
          <h1 className="text-lg font-semibold text-zinc-100">Conti</h1>
          <AddAccountForm institutionId={id} />

          {accounts.length === 0 ? (
            <p className="text-sm text-zinc-500 py-6 text-center border border-dashed border-zinc-800 rounded-xl">
              Nessun conto. Aggiungine uno per iniziare a importare movimenti.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 overflow-hidden">
              {accounts.map((acc) => (
                <li key={acc.id} className="bg-zinc-900">
                  <Link
                    href={`/dashboard/accounts/${acc.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800 transition"
                  >
                    <span className="text-zinc-100">{acc.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">{acc.currency}</span>
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
