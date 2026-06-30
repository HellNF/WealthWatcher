import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getAccountForUser } from '@/lib/accounts'
import { getInstitutionForUser } from '@/lib/institutions'
import { listTransactions, listAllCategories } from '@/lib/transactions'
import TransactionTable from './TransactionTable'
import { Breadcrumb, Card, Stat } from '@/components/ui'
import { fromMinor } from '@/lib/money'
import { Upload, BarChart3 } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default async function AccountPage({ params }: Props) {
  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (isNaN(id)) notFound()

  const user = await requireUser()
  const account = getAccountForUser(user.id, id)
  if (!account) notFound()

  const institution = getInstitutionForUser(user.id, account.institution_id)
  const transactions = listTransactions(user.id, id)
  const categories = listAllCategories()

  // Saldo calcolato dalla somma dei movimenti importati
  const balanceMinor = transactions.reduce((sum, t) => sum + t.amount_minor, 0)
  const hasTxns = transactions.length > 0

  const firstDate = hasTxns
    ? formatDate(transactions[transactions.length - 1].booked_date)
    : null
  const lastDate = hasTxns ? formatDate(transactions[0].booked_date) : null

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-8">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        ...(institution ? [{ label: institution.name, href: `/dashboard/institutions/${institution.id}` }] : []),
        { label: account.name },
      ]} />

      {/* Stats */}
      <Card className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        <Stat
          label="Saldo movimenti"
          value={fromMinor(balanceMinor, account.currency)}
          delta={hasTxns ? balanceMinor : null}
          deltaLabel={balanceMinor >= 0 ? 'positivo' : 'negativo'}
          size="sm"
        />
        <Stat
          label="Valuta"
          value={account.currency}
          size="sm"
        />
        <Stat
          label="Movimenti"
          value={transactions.length.toLocaleString('it-IT')}
          size="sm"
        />
        <Stat
          label="Periodo"
          value={hasTxns ? `${firstDate} – ${lastDate}` : '—'}
          size="sm"
        />
      </Card>

      {/* Azioni */}
      <div className="flex gap-3">
        <Link
          href={`/dashboard/accounts/${id}/import`}
          className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium rounded-lg bg-[--brand] text-[--brand-fg] hover:bg-[--brand-hover] transition-all duration-150"
        >
          <Upload className="size-4" />
          Importa movimenti
        </Link>
        <Link
          href={`/dashboard/reports?account=${id}`}
          className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium rounded-lg border border-[--border] text-[--ink] hover:bg-[--surface-2] transition-all duration-150"
        >
          <BarChart3 className="size-4" />
          Report mensile
        </Link>
      </div>

      {/* Transazioni */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[--ink]">Movimenti</h2>
        <TransactionTable transactions={transactions} categories={categories} />
      </section>
    </main>
  )
}
