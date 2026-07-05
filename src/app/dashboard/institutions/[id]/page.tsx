import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getInstitutionForUser } from '@/lib/institutions'
import { listAccounts, getAccountPreview, estimateInterest } from '@/lib/accounts'
import { listPortfolios } from '@/lib/portfolios'
import { getPortfolioValuationEur } from '@/lib/portfolioValuation'
import { fromMinor } from '@/lib/money'
import AddAccountForm from './AddAccountForm'
import AddPortfolioForm from './AddPortfolioForm'
import EditInstitutionForm from './EditInstitutionForm'
import { deleteInstitutionAction } from './actions'
import {
  Breadcrumb, Card, EmptyState, Badge, ConfirmDelete,
} from '@/components/ui'
import Link from 'next/link'
import { ChevronRight, CreditCard, TrendingUp } from 'lucide-react'

export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<string, string> = {
  bank:   'Banca',
  broker: 'Broker',
  both:   'Banca · Broker',
}

function fmtShort(iso: string | null): string | null {
  if (!iso) return null
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

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

  // Preview conti: saldo + statistiche movimenti + stima interesse.
  const accountPreviews = accounts.map((acc) => {
    const preview = getAccountPreview(acc.id)
    return { acc, preview, interest: estimateInterest(preview.balanceMinor, acc.interest_rate) }
  })

  // Valutazione EUR dei portafogli (valore + P/L%) per le righe.
  const today = new Date().toISOString().slice(0, 10)
  const portfolioVals = await Promise.all(
    portfolios.map((p) => getPortfolioValuationEur(user.id, p.id, today)),
  )

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: institution.name },
      ]} />

      {/* ── Testata + gestione istituzione ─────────────────────────────────── */}
      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-semibold text-[--ink]">{institution.name}</h1>
              <Badge variant="neutral">{KIND_LABEL[institution.kind] ?? institution.kind}</Badge>
            </div>
            <p className="text-sm text-[--muted]">
              {accounts.length} {accounts.length === 1 ? 'conto' : 'conti'} · {portfolios.length}{' '}
              {portfolios.length === 1 ? 'portafoglio' : 'portafogli'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <EditInstitutionForm institutionId={id} name={institution.name} kind={institution.kind} country={institution.country ?? null} />
            <ConfirmDelete
              action={deleteInstitutionAction.bind(null, id)}
              label="Elimina istituzione"
              confirmText="Eliminare istituzione, conti, portafogli e movimenti collegati?"
            />
          </div>
        </div>
      </Card>

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
            {accountPreviews.map(({ acc, preview, interest }) => {
              const last = fmtShort(preview.lastDate)
              const meta = [
                acc.currency,
                `${preview.txCount} ${preview.txCount === 1 ? 'movimento' : 'movimenti'}`,
                last ? `ultimo ${last}` : null,
              ].filter(Boolean).join(' · ')
              return (
                <Link
                  key={acc.id}
                  href={`/dashboard/accounts/${acc.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-[--surface-2] transition-colors duration-100 group"
                >
                  <div className="size-10 rounded-xl bg-[--info-subtle] flex items-center justify-center shrink-0">
                    <CreditCard className="size-5 text-[--info-text]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[--ink] truncate">{acc.name}</p>
                    <p className="text-xs text-[--muted] truncate">{meta}</p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                    <span className="font-mono tabular-nums text-sm font-medium text-[--ink]">
                      {fromMinor(preview.balanceMinor, acc.currency)}
                    </span>
                    {interest && (
                      <span className="text-xs text-[--brand-text]">
                        {interest.ratePercent}% · {fromMinor(interest.grossAnnualMinor, acc.currency)}/anno
                      </span>
                    )}
                  </div>
                  <ChevronRight className="size-4 text-[--faint] group-hover:text-[--muted] transition-colors shrink-0" />
                </Link>
              )
            })}
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
            {portfolios.map((p, i) => {
              const val = portfolioVals[i]
              return (
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
                  <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                    <span className="font-mono tabular-nums text-sm text-[--ink]">
                      {val.marketValueEurMinor !== null
                        ? fromMinor(val.marketValueEurMinor, 'EUR')
                        : '—'}
                    </span>
                    {val.plPct !== null && (
                      <Badge variant={val.plPct >= 0 ? 'gain' : 'loss'}>
                        {val.plPct >= 0 ? '+' : ''}{val.plPct.toFixed(1)}%
                      </Badge>
                    )}
                  </div>
                  <ChevronRight className="size-4 text-[--faint] group-hover:text-[--muted] transition-colors shrink-0" />
                </Link>
              )
            })}
          </Card>
        )}
      </section>
    </main>
  )
}
