import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getAccountForUser, getAccountBalanceMinor } from '@/lib/accounts'
import { getInstitutionForUser } from '@/lib/institutions'
import { listTransactions, listAllCategories } from '@/lib/transactions'
import TransactionTable from './TransactionTable'
import SetBalanceForm from './SetBalanceForm'
import RenameForm from '@/components/dashboard/RenameForm'
import { renameAccountAction, deleteAccountAction } from './manage-actions'
import { Breadcrumb, Card, Stat, ConfirmDelete } from '@/components/ui'
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

  // Saldo: usa il saldo di riferimento manuale se impostato, altrimenti somma i
  // movimenti (fonte unica: getAccountBalanceMinor, condivisa col net worth).
  const balanceMinor = getAccountBalanceMinor(id)
  const hasTxns = transactions.length > 0
  const today = new Date().toISOString().slice(0, 10)
  const prefillAmount = (balanceMinor / 100).toFixed(2)

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

      {/* Stats + gestione saldo */}
      <Card className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <Stat
            label="Saldo"
            value={fromMinor(balanceMinor, account.currency)}
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
        </div>
        <div className="pt-4 border-t border-[--border]">
          <SetBalanceForm
            accountId={id}
            currency={account.currency}
            today={today}
            anchorDate={account.anchor_date}
            prefillAmount={prefillAmount}
          />
        </div>
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

      {/* Gestione conto */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[--ink]">Gestione conto</h2>
        <Card className="flex items-center justify-between gap-4 flex-wrap">
          <RenameForm
            action={renameAccountAction.bind(null, id)}
            currentName={account.name}
            label="Nome conto"
          />
          <ConfirmDelete
            action={deleteAccountAction.bind(null, id)}
            label="Elimina conto"
            confirmText="Eliminare il conto e tutti i suoi movimenti?"
          />
        </Card>
      </section>
    </main>
  )
}
