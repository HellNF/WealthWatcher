import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getAccountForUser } from '@/lib/accounts'
import { getInstitutionForUser } from '@/lib/institutions'
import ImportForm from './ImportForm'
import { Breadcrumb } from '@/components/ui'

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
    <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-6">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        ...(institution ? [{ label: institution.name, href: `/dashboard/institutions/${institution.id}` }] : []),
        { label: account.name, href: `/dashboard/accounts/${id}` },
        { label: 'Importa movimenti' },
      ]} />

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
  )
}
