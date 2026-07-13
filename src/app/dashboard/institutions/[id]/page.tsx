import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getInstitutionForUser } from '@/lib/institutions'
import { listAccounts, getAccountPreview, estimateInterest } from '@/lib/accounts'
import { listPortfolios } from '@/lib/portfolios'
import { getPortfolioValuationEur } from '@/lib/portfolioValuation'
import { fromMinor } from '@/lib/money'
import { formatDateIt } from '@/lib/formatDate'
import { getEnableBankingKey } from '@/lib/userSettings'
import { getAspsps } from '@/lib/banking/client'
import { listConnectionsForInstitution } from '@/lib/banking/connections'
import AddAccountForm from './AddAccountForm'
import AddPortfolioForm from './AddPortfolioForm'
import EditInstitutionForm from './EditInstitutionForm'
import { deleteInstitutionAction } from './actions'
import ConnectBankButton from '@/app/dashboard/banking/ConnectBankButton'
import SyncButton from '@/app/dashboard/banking/SyncButton'
import {
  Breadcrumb, Card, EmptyState, Badge, ConfirmDelete,
} from '@/components/ui'
import Link from 'next/link'
import { ChevronRight, CreditCard, TrendingUp, AlertCircle, Settings } from 'lucide-react'

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
  searchParams: Promise<{ bankingError?: string }>
}

export default async function InstitutionPage({ params, searchParams }: Props) {
  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (isNaN(id)) notFound()
  const sp = await searchParams

  const user = await requireUser()
  const institution = getInstitutionForUser(user.id, id)
  if (!institution) notFound()

  const accounts   = listAccounts(user.id, id)
  const portfolios = listPortfolios(user.id, id)

  // ── Open Banking (Enable Banking) ────────────────────────────────────────
  // Ogni utente usa la propria app Enable Banking (piano gratuito = un'app
  // per account): se non l'ha ancora configurata nelle impostazioni, la
  // sezione mostra un invito a farlo invece di sparire silenziosamente —
  // qui è un'azione che l'utente stesso può completare, non uno switch admin.
  const ebCreds = getEnableBankingKey(user.id)
  // null/'IT' = italiano (stessa convenzione di institutions.country altrove
  // nell'app, es. bollo/IVAFE): senza questo default, un'istituzione senza
  // paese impostato chiederebbe le ASPSP di *tutti* i paesi, centinaia di
  // banche in un'unica lista — il motivo principale per cui era difficile
  // trovare la propria banca nel selettore.
  const aspsps = ebCreds ? await getAspsps(ebCreds, institution.country ?? 'IT') : null
  const connections = ebCreds ? listConnectionsForInstitution(user.id, id) : []
  const visibleConnections = connections.filter((c) => c.status !== 'revoked')

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

      {/* ── Open Banking (Enable Banking) ──────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-[--ink]">Open Banking</h2>

        {sp.bankingError && (
          <div className="flex items-start gap-3 rounded-xl border border-[--danger]/30 bg-[--danger-subtle] px-4 py-3 text-sm text-[--danger-text]">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            Collegamento con la banca non riuscito o annullato. Riprova.
          </div>
        )}

        {!ebCreds ? (
          <Card>
            <div className="flex items-start gap-3">
              <Settings className="size-4 shrink-0 mt-0.5 text-[--muted]" />
              <p className="text-sm text-[--muted]">
                Configura la tua chiave Enable Banking nelle{' '}
                <Link href="/dashboard/settings" className="text-[--brand-text] hover:underline">
                  impostazioni
                </Link>{' '}
                per collegare questa banca e importare saldi e movimenti automaticamente.
              </p>
            </div>
          </Card>
        ) : aspsps === null ? (
          <div className="flex items-start gap-3 rounded-xl border border-[--warning]/30 bg-[--warning-subtle] px-4 py-3 text-sm text-[--warning-text]">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            Impossibile recuperare l&apos;elenco delle banche disponibili da Enable Banking al momento.
          </div>
        ) : (
          <Card>
            <ConnectBankButton institutionId={id} aspsps={aspsps} />
          </Card>
        )}

        {visibleConnections.length > 0 && (
          <Card noPadding className="overflow-hidden">
            {visibleConnections.map((c) => (
              <SyncButton
                key={c.id}
                institutionId={id}
                connectionId={c.id}
                status={c.status}
                aspsp={{ name: c.aspsp_name, country: c.aspsp_country }}
                lastSyncedAt={c.last_synced_at ? formatDateIt(c.last_synced_at) : null}
              />
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
