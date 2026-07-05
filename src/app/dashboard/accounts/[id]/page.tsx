import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getAccountForUser, getAccountBalanceMinor, estimateInterest } from '@/lib/accounts'
import { getInstitutionForUser } from '@/lib/institutions'
import { providerParser } from '@/lib/providers'
import { listTransactions, countTransactions, listAllCategories } from '@/lib/transactions'
import TxnFilters from './TxnFilters'
import TransactionTable from './TransactionTable'
import SetBalanceForm from './SetBalanceForm'
import InterestForm from './InterestForm'
import RenameForm from '@/components/dashboard/RenameForm'
import { renameAccountAction, deleteAccountAction } from './manage-actions'
import { Breadcrumb, Card, Stat, ConfirmDelete } from '@/components/ui'
import { fromMinor } from '@/lib/money'
import { Upload, BarChart3, PiggyBank } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ from?: string; to?: string; all?: string }>
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default async function AccountPage({ params, searchParams }: Props) {
  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (isNaN(id)) notFound()

  const user = await requireUser()
  const account = getAccountForUser(user.id, id)
  if (!account) notFound()

  const sp   = await searchParams
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? '') ? sp.from : undefined
  const to   = /^\d{4}-\d{2}-\d{2}$/.test(sp.to   ?? '') ? sp.to   : undefined
  const all  = sp.all === '1'
  const limit = all ? 99_999 : 50

  const institution  = getInstitutionForUser(user.id, account.institution_id)
  const transactions = listTransactions(user.id, id, { from, to, limit })
  const totalCount   = countTransactions(user.id, id, { from, to })
  const categories   = listAllCategories()

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

  const interest = estimateInterest(balanceMinor, account.interest_rate)
  const importSupported = providerParser(institution?.provider) !== null

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-8">
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
      <div className="flex gap-3 items-center flex-wrap">
        {importSupported ? (
          <Link
            href={`/dashboard/accounts/${id}/import`}
            className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium rounded-lg bg-[--brand] text-[--brand-fg] hover:bg-[--brand-hover] transition-all duration-150"
          >
            <Upload className="size-4" />
            Importa movimenti
          </Link>
        ) : (
          <span className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium rounded-lg border border-[--border] text-[--faint] cursor-not-allowed" title="Import non supportato per questa banca">
            <Upload className="size-4" />
            Import non disponibile
          </span>
        )}
        <Link
          href={`/dashboard/reports?account=${id}`}
          className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium rounded-lg border border-[--border] text-[--ink] hover:bg-[--surface-2] transition-all duration-150"
        >
          <BarChart3 className="size-4" />
          Report mensile
        </Link>
      </div>

      {/* Interesse sulla giacenza */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[--ink]">Interesse sulla giacenza</h2>
        <Card className="space-y-5">
          {interest ? (
            <div className="flex items-start gap-4 flex-wrap">
              <div className="size-10 rounded-xl bg-[--brand-subtle] flex items-center justify-center shrink-0">
                <PiggyBank className="size-5 text-[--brand-text]" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 flex-1">
                <Stat label="Tasso annuo" value={`${interest.ratePercent}%`} size="sm" />
                <Stat label="Interesse lordo / anno" value={fromMinor(interest.grossAnnualMinor, account.currency)} size="sm" />
                <Stat
                  label="Netto / anno (−26%)"
                  value={fromMinor(interest.netAnnualMinor, account.currency)}
                  size="sm"
                  sub={`≈ ${fromMinor(Math.round(interest.netAnnualMinor / 12), account.currency)} / mese`}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-[--muted]">
              Questo conto non è remunerato. Se la banca riconosce un interesse sulla giacenza,
              impostane il tasso per vedere la stima del rendimento.
            </p>
          )}
          <div className="pt-4 border-t border-[--border]">
            <InterestForm accountId={id} currentRate={account.interest_rate} />
          </div>
        </Card>
      </section>

      {/* Transazioni */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[--ink]">Movimenti</h2>
        <TxnFilters from={from} to={to} shown={transactions.length} total={totalCount} />
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
