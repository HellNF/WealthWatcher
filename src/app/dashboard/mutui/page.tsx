import { requireUser } from '@/lib/dal'
import { listMortgages, monthlyPaymentMinor, mortgageStatus } from '@/lib/mortgages'
import { fromMinor } from '@/lib/money'
import { listAccounts } from '@/lib/accounts'
import MortgageForm from './MortgageForm'
import { deleteMortgageAction } from './actions'
import {
  Breadcrumb, Card, Stat, EmptyState, ConfirmDelete, ProgressBar,
} from '@/components/ui'
import Link from 'next/link'
import { Home } from 'lucide-react'

export const dynamic = 'force-dynamic'

function fmtEur(minor: number) {
  return fromMinor(minor, 'EUR')
}

export default async function MutuiPage() {
  const user      = await requireUser()
  const mortgages = listMortgages(user.id)
  const accounts  = listAccounts(user.id)
  const today     = new Date().toISOString().slice(0, 10)

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Mutui' },
      ]} />

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[--ink]">Mutui</h1>
          <p className="text-sm text-[--muted] mt-0.5">Piano di ammortamento alla francese e monitoraggio capitale residuo.</p>
        </div>
      </div>

      {/* Lista mutui */}
      {mortgages.length === 0 ? (
        <EmptyState
          icon={Home}
          title="Nessun mutuo registrato"
          description="Aggiungi il tuo mutuo per vedere il piano di ammortamento e monitorare il capitale residuo."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mortgages.map((m) => {
            const R      = monthlyPaymentMinor(m.initial_capital_minor, m.annual_interest_rate, m.duration_months)
            const status = mortgageStatus(m, today)
            const pct    = status.percentagePaid
            const rateDisplay = (parseFloat(m.annual_interest_rate) * 100).toFixed(2).replace('.', ',')

            return (
              <Card key={m.id} className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/dashboard/mutui/${m.id}`} className="font-semibold text-[--ink] hover:text-[--brand-text] hover:underline truncate block">
                      {m.name}
                    </Link>
                    <p className="text-xs text-[--muted] mt-0.5">
                      {m.duration_months} mesi · {rateDisplay}% annuo · dal {m.start_date}
                    </p>
                  </div>
                  <ConfirmDelete
                    action={deleteMortgageAction.bind(null, m.id)}
                    label="Elimina"
                    confirmText={`Eliminare il mutuo "${m.name}"?`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Rata mensile"      value={fmtEur(R)}                            size="sm" />
                  <Stat label="Capitale residuo"  value={fmtEur(status.remainingCapitalMinor)} size="sm" />
                  <Stat label="di cui interessi"  value={fmtEur(status.currentRateInterest)}   size="sm" />
                  <Stat label="di cui capitale"   value={fmtEur(status.currentRatePrincipal)}  size="sm" />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-[--muted]">
                    <span>Estinzione</span>
                    <span className="tabular-nums">{pct}%</span>
                  </div>
                  <ProgressBar
                    value={status.totalPaidMinor}
                    max={R * m.duration_months}
                    color={pct >= 100 ? 'var(--brand)' : 'var(--brand)'}
                  />
                  <p className="text-xs text-[--faint]">Versato {fmtEur(status.totalPaidMinor)} su {fmtEur(R * m.duration_months)} totali</p>
                </div>

                <Link href={`/dashboard/mutui/${m.id}`} className="text-xs text-[--brand-text] hover:underline">
                  Vedi piano di ammortamento →
                </Link>
              </Card>
            )
          })}
        </div>
      )}

      {/* Aggiungi mutuo */}
      <Card className="max-w-xl">
        <h2 className="text-sm font-semibold text-[--ink] mb-4">Aggiungi mutuo</h2>
        <MortgageForm accounts={accounts} />
      </Card>
    </main>
  )
}
