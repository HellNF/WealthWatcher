import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getAccountForUser } from '@/lib/accounts'
import { getInstitutionForUser } from '@/lib/institutions'
import ImportForm from './ImportForm'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ImportPage({ params }: Props) {
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
          <Link
            href={`/dashboard/accounts/${id}`}
            className="text-zinc-500 hover:text-zinc-200 transition"
          >
            {account.name}
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="font-semibold text-zinc-100">Importa CSV</span>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Importa movimenti — Intesa Sanpaolo</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Esporta &ldquo;Lista Operazioni&rdquo; da{' '}
            <span className="text-zinc-400">Intesa Sanpaolo → Estratti Conto</span>
            {' '}in formato Excel (.xlsx) e caricala qui.
          </p>
        </div>

        <ImportForm accountId={id} />
      </main>
    </div>
  )
}
