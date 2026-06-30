import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getInstitutionForUser } from '@/lib/institutions'
import { listAccounts } from '@/lib/accounts'
import { listPortfolios } from '@/lib/portfolios'
import AddAccountForm from './AddAccountForm'
import AddPortfolioForm from './AddPortfolioForm'
import { Breadcrumb } from '@/components/ui'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

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

  const accounts   = listAccounts(user.id, id)
  const portfolios = listPortfolios(user.id, id)

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-10">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: institution.name },
      ]} />

      {/* Conti bancari */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Conti</h2>
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
                    <ChevronRight className="size-4 text-zinc-600" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Portafogli investimenti */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Portafogli investimenti</h2>
        <AddPortfolioForm institutionId={id} />

        {portfolios.length === 0 ? (
          <p className="text-sm text-zinc-500 py-6 text-center border border-dashed border-zinc-800 rounded-xl">
            Nessun portafoglio. Aggiungine uno per tracciare i tuoi investimenti.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800 overflow-hidden">
            {portfolios.map((p) => (
              <li key={p.id} className="bg-zinc-900">
                <Link
                  href={`/dashboard/portfolios/${p.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800 transition"
                >
                  <span className="text-zinc-100">{p.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">{p.currency}</span>
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
