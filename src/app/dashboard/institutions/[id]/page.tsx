import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getInstitutionForUser } from '@/lib/institutions'
import { listAccounts, getAccountPreview, estimateInterest } from '@/lib/accounts'
import { listPortfolios } from '@/lib/portfolios'
import { getPortfolioValuationEur } from '@/lib/portfolioValuation'
import { formatMoney } from '@/lib/money'
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
  Card, EmptyState, Badge, ConfirmDelete, PageHeader, HeroShell, Eyebrow, StickyBar, PAGE_SHELL,
} from '@/components/ui'
import { AddSection } from '@/components/dashboard/AddSection'
import { getInstitutionValueEur } from '@/lib/institutionValuation'
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

  const instValue = await getInstitutionValueEur(user.id, id, today)
  const portfoliosEurMinor = portfolioVals.reduce((sum, v) => sum + (v.marketValueEurMinor ?? 0), 0)
  const accountsEurMinor   = Math.max(0, instValue.valueEurMinor - portfoliosEurMinor)
  const KEY = 'text-2xl sm:text-3xl font-extrabold font-display tabular-nums leading-none tracking-[-0.02em] text-(--ink)'
  const ROW = 'group flex items-center gap-3.5 px-4 sm:px-5 py-3.5 hover:bg-(--surface-2) active:bg-(--surface-2) transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--ring)'
  const TILE = 'size-9 rounded-xl bg-(--surface-2) ring-1 ring-(--border) flex items-center justify-center shrink-0'
  const CHEVRON = 'size-4 text-(--faint) shrink-0 transition-[color,transform] duration-200 ease-out-strong group-hover:text-(--ink) group-hover:translate-x-0.5'

  return (
    <>
    <StickyBar watchId="inst-value">
      <span className="text-sm font-medium text-(--ink) truncate">{institution.name}</span>
      <span className="text-sm text-(--muted)">
        Valore <span className="font-mono tabular-nums font-semibold text-(--ink)">{formatMoney(instValue.valueEurMinor, 'EUR')}</span>
      </span>
    </StickyBar>
    <main className={`${PAGE_SHELL} space-y-8`}>
      <PageHeader
        breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: institution.name }]}
        title={institution.name}
        meta={<Badge variant="neutral">{KIND_LABEL[institution.kind] ?? institution.kind}</Badge>}
        actions={
          <>
            <EditInstitutionForm institutionId={id} name={institution.name} kind={institution.kind} country={institution.country ?? null} />
            <ConfirmDelete
              action={deleteInstitutionAction.bind(null, id)}
              label="Elimina istituzione"
              confirmText="Eliminare istituzione, conti, portafogli e movimenti collegati?"
            />
          </>
        }
      />

      {/* ── Hero: quanto ho presso questa istituzione ─────────────────────── */}
      <HeroShell innerClassName="grid gap-x-14 gap-y-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end p-6 sm:p-8">
        <div className="space-y-4 min-w-0">
          <Eyebrow>Valore complessivo</Eyebrow>
          <p id="inst-value" className="text-5xl sm:text-6xl font-extrabold font-display tabular-nums leading-none tracking-[-0.03em] text-(--ink)">
            {formatMoney(instValue.valueEurMinor, 'EUR')}
          </p>
          <p className="text-sm text-(--muted)">
            {accounts.length} {accounts.length === 1 ? 'conto' : 'conti'} e {portfolios.length}{' '}
            {portfolios.length === 1 ? 'portafoglio' : 'portafogli'}
            {instValue.stale && <span className="text-(--warning-text)"> · valore parziale: manca qualche prezzo o cambio</span>}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-10 gap-y-6 border-t border-(--border) pt-5 xl:border-t-0 xl:pt-0 xl:border-l xl:pl-14">
          <div className="space-y-1.5">
            <dt className="text-xs font-medium text-(--muted)">Sui conti</dt>
            <dd className={KEY}>{formatMoney(accountsEurMinor, 'EUR')}</dd>
          </div>
          <div className="space-y-1.5">
            <dt className="text-xs font-medium text-(--muted)">Investito in portafogli</dt>
            <dd className={KEY}>{formatMoney(portfoliosEurMinor, 'EUR')}</dd>
          </div>
        </dl>
      </HeroShell>

      {/* ── Conti + portafogli affiancati ──────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-8 xl:items-start">
        <AddSection
          title="Conti bancari"
          icon={<CreditCard className="size-4 text-(--muted)" strokeWidth={1.75} />}
          addLabel="Aggiungi conto"
          form={<Card><AddAccountForm institutionId={id} /></Card>}
        >
          {accounts.length === 0 ? (
            <Card>
              <EmptyState
                icon={CreditCard}
                title="Nessun conto"
                description="Aggiungi un conto corrente per iniziare a importare i movimenti bancari."
              />
            </Card>
          ) : (
            <Card noPadding className="overflow-hidden divide-y divide-(--border)">
              {accountPreviews.map(({ acc, preview, interest }) => {
                const last = fmtShort(preview.lastDate)
                const meta = [
                  acc.currency,
                  `${preview.txCount} ${preview.txCount === 1 ? 'movimento' : 'movimenti'}`,
                  last ? `ultimo ${last}` : null,
                ].filter(Boolean).join(' · ')
                return (
                  <Link key={acc.id} href={`/dashboard/accounts/${acc.id}`} className={ROW}>
                    <span className={TILE} aria-hidden><CreditCard className="size-4 text-(--muted)" strokeWidth={1.75} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-(--ink) truncate">{acc.name}</span>
                      <span className="block text-xs text-(--muted) truncate">{meta}</span>
                    </span>
                    <span className="text-right shrink-0 flex flex-col items-end gap-0.5">
                      <span className="font-mono tabular-nums text-sm font-medium text-(--ink)">
                        {formatMoney(preview.balanceMinor, acc.currency)}
                      </span>
                      {interest && (
                        <span className="text-xs text-(--muted) font-mono tabular-nums">
                          {interest.ratePercent}% · {formatMoney(interest.grossAnnualMinor, acc.currency)}/anno
                        </span>
                      )}
                    </span>
                    <ChevronRight className={CHEVRON} aria-hidden />
                  </Link>
                )
              })}
            </Card>
          )}
        </AddSection>

        <AddSection
          title="Portafogli d'investimento"
          icon={<TrendingUp className="size-4 text-(--muted)" strokeWidth={1.75} />}
          addLabel="Aggiungi portafoglio"
          form={<Card><AddPortfolioForm institutionId={id} /></Card>}
        >
          {portfolios.length === 0 ? (
            <Card>
              <EmptyState
                icon={TrendingUp}
                title="Nessun portafoglio"
                description="Aggiungi un portafoglio per tracciare ETF, azioni e altri strumenti finanziari."
              />
            </Card>
          ) : (
            <Card noPadding className="overflow-hidden divide-y divide-(--border)">
              {portfolios.map((p, i) => {
                const val = portfolioVals[i]
                return (
                  <Link key={p.id} href={`/dashboard/portfolios/${p.id}`} className={ROW}>
                    <span className={TILE} aria-hidden><TrendingUp className="size-4 text-(--muted)" strokeWidth={1.75} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-(--ink) truncate">{p.name}</span>
                      <span className="block text-xs text-(--muted)">{p.currency}</span>
                    </span>
                    <span className="text-right shrink-0 flex flex-col items-end gap-0.5">
                      <span className="font-mono tabular-nums text-sm font-medium text-(--ink)">
                        {val.marketValueEurMinor !== null ? formatMoney(val.marketValueEurMinor, 'EUR') : '—'}
                      </span>
                      {val.plPct !== null && (
                        <span className={`text-xs font-mono tabular-nums ${val.plPct > 0 ? 'text-(--brand-text)' : val.plPct < 0 ? 'text-(--danger-text)' : 'text-(--muted)'}`}>
                          {val.plPct >= 0 ? '+' : ''}{val.plPct.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                        </span>
                      )}
                    </span>
                    <ChevronRight className={CHEVRON} aria-hidden />
                  </Link>
                )
              })}
            </Card>
          )}
        </AddSection>
      </div>

      {/* ── Open Banking (Enable Banking) ──────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-(--ink)">Open Banking</h2>

        {sp.bankingError && (
          <div className="flex items-start gap-3 rounded-xl border border-(--danger)/30 bg-(--danger-subtle) px-4 py-3 text-sm text-(--danger-text)" role="alert">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            Collegamento con la banca non riuscito o annullato. Riprova.
          </div>
        )}

        {!ebCreds ? (
          <Card>
            <div className="flex items-start gap-3">
              <Settings className="size-4 shrink-0 mt-0.5 text-(--muted)" />
              <p className="text-sm text-(--muted) max-w-[75ch]">
                Configura la tua chiave Enable Banking nelle{' '}
                <Link href="/dashboard/settings" className="text-(--brand-text) hover:underline">
                  impostazioni
                </Link>{' '}
                per collegare questa banca e importare saldi e movimenti automaticamente.
              </p>
            </div>
          </Card>
        ) : aspsps === null ? (
          <div className="flex items-start gap-3 rounded-xl border border-(--warning)/30 bg-(--warning-subtle) px-4 py-3 text-sm text-(--warning-text)">
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
    </main>
    </>
  )
}
