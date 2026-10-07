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
import AccountSyncButton from './AccountSyncButton'
import BalanceTrend, { type BalancePoint } from './BalanceTrend'
import RenameForm from '@/components/dashboard/RenameForm'
import { renameAccountAction, deleteAccountAction } from './manage-actions'
import { Card, Stat, ConfirmDelete, PageHeader, HeroShell, Eyebrow, StickyBar, PAGE_SHELL } from '@/components/ui'
import { formatMoney } from '@/lib/money'
import { Upload, BarChart3 } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  params:       Promise<{ id: string }>
  searchParams: Promise<{ from?: string; to?: string; all?: string }>
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
  const today = new Date().toISOString().slice(0, 10)
  const prefillAmount = (balanceMinor / 100).toFixed(2)

  const interest = estimateInterest(balanceMinor, account.interest_rate)
  const importSupported = providerParser(institution?.provider) !== null

  // ── Dati per la colonna di riepilogo ───────────────────────────────────────
  const allTxns   = listTransactions(user.id, id, { limit: 99_999 }) // dal più recente
  const latestTxn = allTxns[0] ?? null
  const totalAll  = allTxns.length

  // Andamento del saldo: parte dal saldo di oggi e torna indietro movimento per movimento.
  const balancePoints: BalancePoint[] = []
  {
    let running = balanceMinor
    let i = 0
    while (i < allTxns.length) {
      const date = allTxns[i].booked_date
      balancePoints.push({ date, value: running })           // saldo a fine giornata
      while (i < allTxns.length && allTxns[i].booked_date === date) { running -= allTxns[i].amount_minor; i++ }
    }
    balancePoints.reverse()
    if (balancePoints.at(-1)?.date !== today) balancePoints.push({ date: today, value: balanceMinor })
  }
  const trend = balancePoints.slice(-200)

  // Periodo del riepilogo: i filtri della lista se impostati, altrimenti i 3 mesi fino all'ultimo movimento.
  const periodTo   = to ?? latestTxn?.booked_date ?? today
  const periodFrom = from ?? (() => {
    const d = new Date(`${periodTo}T12:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() - 3)
    return d.toISOString().slice(0, 10)
  })()
  const inPeriod  = allTxns.filter((t) => t.booked_date >= periodFrom && t.booked_date <= periodTo)
  const periodIn  = inPeriod.filter((t) => t.amount_minor > 0).reduce((sum, t) => sum + t.amount_minor, 0)
  const periodOut = inPeriod.filter((t) => t.amount_minor < 0).reduce((sum, t) => sum - t.amount_minor, 0)

  const byCategory = new Map<string, number>()
  for (const t of inPeriod) {
    if (t.amount_minor >= 0) continue
    const key = t.category_name ?? 'Senza categoria'
    byCategory.set(key, (byCategory.get(key) ?? 0) - t.amount_minor)
  }
  const catSorted = [...byCategory.entries()].sort((x, y) => y[1] - x[1])
  const catTop    = catSorted.slice(0, 6)
  const catRest   = catSorted.slice(6).reduce((sum, [, v]) => sum + v, 0)
  if (catRest > 0) catTop.push(['Altre categorie', catRest])
  const catMax    = catTop[0]?.[1] ?? 0

  // Mese per mese: ultimi 6 mesi con movimenti
  const byMonth = new Map<string, { inMinor: number; outMinor: number }>()
  for (const t of allTxns) {
    const m = t.booked_date.slice(0, 7)
    const row = byMonth.get(m) ?? { inMinor: 0, outMinor: 0 }
    if (t.amount_minor > 0) row.inMinor += t.amount_minor
    else row.outMinor -= t.amount_minor
    byMonth.set(m, row)
  }
  const months = [...byMonth.entries()].sort((x, y) => y[0].localeCompare(x[0])).slice(0, 6)
  const monthMaxOut = Math.max(1, ...months.map(([, r]) => r.outMinor))

  const money = (minor: number, decimals = 0) =>
    (minor / 100).toLocaleString('it-IT', {
      style: 'currency', currency: account.currency, useGrouping: 'always',
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    })
  const MONTHS_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
  const monthLabel = (m: string) => `${MONTHS_IT[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
  const dayLabel = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS_IT[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`

  const LINK = 'inline-flex items-center gap-2 h-9 px-3.5 text-sm font-medium rounded-lg border border-(--border) text-(--ink) hover:bg-(--surface-2) active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--ring)'

  return (
    <>
    <StickyBar watchId="account-balance">
      <span className="text-sm font-medium text-(--ink) truncate">{account.name}</span>
      <span className="text-sm text-(--muted)">
        Saldo <span className="font-mono tabular-nums font-semibold text-(--ink)">{formatMoney(balanceMinor, account.currency)}</span>
      </span>
      <span className="ml-auto text-xs text-(--muted)">{totalAll.toLocaleString('it-IT')} movimenti</span>
    </StickyBar>
    <main className={`${PAGE_SHELL} space-y-8`}>
      <PageHeader
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          ...(institution ? [{ label: institution.name, href: `/dashboard/institutions/${institution.id}` }] : []),
          { label: account.name },
        ]}
        title={account.name}
        description={institution ? `Conto corrente · ${institution.name} · ${account.currency}` : `Conto corrente · ${account.currency}`}
        actions={
          <>
            {account.eb_connection_id && <AccountSyncButton connectionId={account.eb_connection_id} />}
            <Link href={`/dashboard/reports?account=${id}`} className={LINK}>
              <BarChart3 className="size-4" strokeWidth={1.75} />
              Report mensile
            </Link>
            {importSupported ? (
              <Link
                href={`/dashboard/accounts/${id}/import`}
                className="inline-flex items-center gap-2 h-9 px-3.5 text-sm font-medium rounded-lg bg-(--brand) text-(--brand-fg) shadow-[var(--shadow-sm),inset_0_1px_0_0_oklch(1_0_0/0.25)] hover:bg-(--brand-hover) active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)"
              >
                <Upload className="size-4" strokeWidth={1.75} />
                Importa movimenti
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2 h-9 px-3.5 text-sm rounded-lg border border-dashed border-(--border) text-(--muted)" title="Import non supportato per questa banca">
                <Upload className="size-4" strokeWidth={1.75} />
                Import non disponibile
              </span>
            )}
          </>
        }
      />

      {/* Due colonne: movimenti a sinistra, riepilogo a destra. Su desktop la lista
          scorre dentro il proprio pannello e finisce esattamente dove finisce il riepilogo. */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_28rem] min-[131rem]:grid-cols-[minmax(0,1fr)_32rem] gap-x-8 2xl:gap-x-10 gap-y-8 xl:items-stretch">

        {/* ── Movimenti ────────────────────────────────────────────────────── */}
        <section className="order-2 xl:order-1 min-w-0 flex flex-col gap-4">
          <div className="flex items-end justify-between gap-x-6 gap-y-3 flex-wrap">
            <h2 className="text-base font-semibold text-(--ink)">Movimenti</h2>
            <TxnFilters from={from} to={to} shown={transactions.length} total={totalCount} />
          </div>
          <div className="relative xl:flex-1 xl:min-h-[32rem]">
            <div className="xl:absolute xl:inset-0 xl:overflow-y-auto xl:rounded-2xl xl:[&_thead_th]:sticky xl:[&_thead_th]:top-0 xl:[&_thead_th]:z-[1] xl:[&_thead_th]:bg-(--surface)">
              <TransactionTable transactions={transactions} categories={categories} />
            </div>
          </div>
        </section>

        {/* ── Riepilogo ────────────────────────────────────────────────────── */}
        <aside className="order-1 xl:order-2 min-w-0 flex flex-col gap-6">
          <HeroShell innerClassName="p-5 sm:p-6 gap-5">
            <div className="space-y-3">
              <Eyebrow>Saldo</Eyebrow>
              <p id="account-balance" className={`text-4xl sm:text-5xl font-extrabold font-display tabular-nums leading-none tracking-[-0.03em] ${balanceMinor < 0 ? 'text-(--danger-text)' : 'text-(--ink)'}`}>
                {formatMoney(balanceMinor, account.currency)}
              </p>
              <p className="text-xs text-(--muted)">
                {latestTxn ? <>Ultimo movimento il {dayLabel(latestTxn.booked_date)} · {totalAll.toLocaleString('it-IT')} movimenti</> : <>Nessun movimento importato</>}
              </p>
            </div>
            <BalanceTrend points={trend} currency={account.currency} />
            <div className="border-t border-(--border) pt-4">
              <SetBalanceForm
                accountId={id}
                currency={account.currency}
                today={today}
                anchorDate={account.anchor_date}
                prefillAmount={prefillAmount}
              />
            </div>
          </HeroShell>

          {/* Dove sono andati i soldi nel periodo */}
          <Card className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-(--ink)">Uscite per categoria</h2>
              <p className="text-xs text-(--muted)">
                Dal {dayLabel(periodFrom)} al {dayLabel(periodTo)}{from || to ? ' (periodo filtrato)' : ''}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <dt className="text-xs font-medium text-(--muted)">Entrate</dt>
                <dd className="text-lg font-medium font-mono tabular-nums leading-none text-(--ink)">{money(periodIn)}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs font-medium text-(--muted)">Uscite</dt>
                <dd className="text-lg font-medium font-mono tabular-nums leading-none text-(--ink)">{money(periodOut)}</dd>
              </div>
            </dl>
            {catTop.length === 0 ? (
              <p className="text-sm text-(--muted)">Nessuna uscita nel periodo.</p>
            ) : (
              <ul className="space-y-2.5 border-t border-(--border) pt-4">
                {catTop.map(([name, value]) => (
                  <li key={name} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-(--ink) truncate">{name}</span>
                      <span className="shrink-0 font-mono tabular-nums text-(--ink)">
                        {money(value)}
                        <span className="ml-2 inline-block w-9 text-right text-xs font-sans text-(--muted)">
                          {periodOut > 0 ? Math.round((value / periodOut) * 100) : 0}%
                        </span>
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-(--surface-2) overflow-hidden" aria-hidden>
                      <div className="h-full rounded-full bg-(--muted)" style={{ width: `${catMax > 0 ? Math.max(2, (value / catMax) * 100) : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Confronto con i mesi precedenti */}
          {months.length > 0 && (
            <Card className="space-y-3">
              <h2 className="text-sm font-semibold text-(--ink)">Mese per mese</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-(--muted)">
                    <th scope="col" className="text-left font-medium pb-2">Mese</th>
                    <th scope="col" className="text-right font-medium pb-2">Entrate</th>
                    <th scope="col" className="text-right font-medium pb-2">Uscite</th>
                    <th scope="col" className="text-right font-medium pb-2">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--border)">
                  {months.map(([m, r]) => {
                    const net = r.inMinor - r.outMinor
                    return (
                      <tr key={m}>
                        <th scope="row" className="py-2 text-left font-normal text-(--ink) whitespace-nowrap">
                          {monthLabel(m)}
                          <span className="block h-0.5 mt-1.5 rounded-full bg-(--muted)/60" style={{ width: `${Math.max(4, (r.outMinor / monthMaxOut) * 100)}%` }} aria-hidden />
                        </th>
                        <td className="py-2 text-right font-mono tabular-nums text-(--ink)">{money(r.inMinor)}</td>
                        <td className="py-2 text-right font-mono tabular-nums text-(--ink)">{money(r.outMinor)}</td>
                        <td className={`py-2 text-right font-mono tabular-nums ${net > 0 ? 'text-(--brand-text)' : net < 0 ? 'text-(--danger-text)' : 'text-(--muted)'}`}>
                          {net > 0 ? '+' : net < 0 ? '−' : ''}{money(Math.abs(net))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </Card>
          )}

          <Card className="space-y-4">
            <h2 className="text-sm font-semibold text-(--ink)">Interesse sulla giacenza</h2>
            {interest ? (
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Tasso annuo" value={`${interest.ratePercent}%`} size="sm" />
                <Stat
                  label="Netto / anno (−26%)"
                  value={formatMoney(interest.netAnnualMinor, account.currency)}
                  size="sm"
                  sub={`lordo ${formatMoney(interest.grossAnnualMinor, account.currency)} · ≈ ${formatMoney(Math.round(interest.netAnnualMinor / 12), account.currency)}/mese`}
                />
              </div>
            ) : (
              <p className="text-sm text-(--muted)">
                Conto non remunerato. Se la banca riconosce un interesse, imposta il tasso per vedere la stima.
              </p>
            )}
            <InterestForm accountId={id} currentRate={account.interest_rate} />
          </Card>

          <Card className="space-y-4">
            <h2 className="text-sm font-semibold text-(--ink)">Gestione conto</h2>
            <div className="flex items-center justify-between gap-4 flex-wrap">
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
            </div>
          </Card>
        </aside>
      </div>
    </main>
    </>
  )
}
