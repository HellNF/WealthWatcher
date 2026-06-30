import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getInstitutionForUser } from '@/lib/institutions'
import { listAccounts } from '@/lib/accounts'
import { listPortfolios } from '@/lib/portfolios'
import AddAccountForm from './AddAccountForm'
import AddPortfolioForm from './AddPortfolioForm'
import {
  Breadcrumb, Card, EmptyState,
} from '@/components/ui'
import Link from 'next/link'
import { ChevronRight, CreditCard, TrendingUp } from 'lucide-react'

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
    <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-8">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: institution.name },
      ]} />

      {/* ── Conti bancari ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-[--ink]">Conti bancari</h2>

        <Card>
          <AddAccountForm institutionId={id} />
        </Card>

        {accounts.length === 0 ? (
          <Card>
            <EmptyState
              icon={CreditCard}
              title="Nessun conto"
              description="Aggiungi un conto corrente per iniziare a importare i movimenti bancari."
            />
          </Card>
        ) : (
          <Card noPadding className="overflow-hidden divide-y divide-[--border]">
            {accounts.map((acc) => (
              <Link
                key={acc.id}
                href={`/dashboard/accounts/${acc.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-[--surface-2] transition-colors duration-100 group"
              >
                <div className="size-9 rounded-xl bg-[--info-subtle] flex items-center justify-center shrink-0">
                  <CreditCard className="size-4 text-[--info-text]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[--ink] truncate">{acc.name}</p>
                  <p className="text-xs text-[--muted]">{acc.currency}</p>
                </div>
                <ChevronRight className="size-4 text-[--faint] group-hover:text-[--muted] transition-colors shrink-0" />
              </Link>
            ))}
          </Card>
        )}
      </section>

      {/* ── Portafogli investimenti ────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-[--ink]">Portafogli investimenti</h2>

        <Card>
          <AddPortfolioForm institutionId={id} />
        </Card>

        {portfolios.length === 0 ? (
          <Card>
            <EmptyState
              icon={TrendingUp}
              title="Nessun portafoglio"
              description="Aggiungi un portafoglio per tracciare ETF, azioni e altri strumenti finanziari."
            />
          </Card>
        ) : (
          <Card noPadding className="overflow-hidden divide-y divide-[--border]">
            {portfolios.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/portfolios/${p.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-[--surface-2] transition-colors duration-100 group"
              >
                <div className="size-9 rounded-xl bg-[--brand-subtle] flex items-center justify-center shrink-0">
                  <TrendingUp className="size-4 text-[--brand-text]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[--ink] truncate">{p.name}</p>
                  <p className="text-xs text-[--muted]">{p.currency}</p>
                </div>
                <ChevronRight className="size-4 text-[--faint] group-hover:text-[--muted] transition-colors shrink-0" />
              </Link>
            ))}
          </Card>
        )}
      </section>
    </main>
  )
}
