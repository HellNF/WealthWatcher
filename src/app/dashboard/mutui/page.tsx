import { requireUser } from '@/lib/dal'
import { listMortgages, monthlyPaymentMinor, mortgageStatus, amortizationSchedule } from '@/lib/mortgages'
import { formatMoney } from '@/lib/money'
import { listAccounts } from '@/lib/accounts'
import MortgageForm from './MortgageForm'
import { deleteMortgageAction } from './actions'
import {
  Card, ConfirmDelete, ProgressBar, PageHeader, HeroShell, Eyebrow, StickyBar, PAGE_SHELL,
} from '@/components/ui'
import { AddSection } from '@/components/dashboard/AddSection'
import Link from 'next/link'
import { ChevronRight, Home, CalendarClock, TrendingDown, Landmark } from 'lucide-react'

export const dynamic = 'force-dynamic'

function fmtEur(minor: number, decimals = 2) {
  return decimals === 2
    ? formatMoney(minor, 'EUR')
    : (minor / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always', maximumFractionDigits: 0 })
}

function fmtDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('it-IT', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Rome',
  })
}

const KEY = 'text-2xl sm:text-3xl font-extrabold font-display tabular-nums leading-none tracking-[-0.02em] text-(--ink)'

export default async function MutuiPage() {
  const user      = await requireUser()
  const mortgages = listMortgages(user.id)
  const accounts  = listAccounts(user.id)
  const today     = new Date().toISOString().slice(0, 10)

  const rows = mortgages.map((m) => {
    const R        = monthlyPaymentMinor(m.initial_capital_minor, m.annual_interest_rate, m.duration_months)
    const status   = mortgageStatus(m, today)
    const schedule = amortizationSchedule(m)
    const next     = schedule.find((r) => r.date >= today) ?? null
    const last     = schedule.at(-1) ?? null
    return { m, R, status, next, last, totalDue: R * m.duration_months }
  })

  const totalRemaining = rows.reduce((s, r) => s + r.status.remainingCapitalMinor, 0)
  const totalMonthly   = rows.filter((r) => r.next).reduce((s, r) => s + r.R, 0)
  const totalInitial   = rows.reduce((s, r) => s + r.m.initial_capital_minor, 0)
  const repaidPct      = totalInitial > 0 ? Math.round(((totalInitial - totalRemaining) / totalInitial) * 100) : 0
  const nextPayment    = rows.filter((r) => r.next).sort((a, b) => a.next!.date.localeCompare(b.next!.date))[0] ?? null
  const lastEnd        = rows.map((r) => r.last?.date).filter((d): d is string => !!d).sort().at(-1) ?? null

  // ── Primo avvio: l'hero spiega cosa si ottiene e contiene già il modulo ─────
  if (mortgages.length === 0) {
    return (
      <main className={`${PAGE_SHELL} space-y-8`}>
        <PageHeader
          breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Mutui' }]}
          title="Mutui"
        />
        <HeroShell innerClassName="grid gap-x-14 gap-y-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,40rem)] xl:items-center p-6 sm:p-8">
          <div className="space-y-6 min-w-0">
            <Eyebrow>Nessun mutuo registrato</Eyebrow>
            <h2 className="text-4xl sm:text-5xl font-extrabold font-display leading-[1.05] tracking-[-0.03em] text-(--ink) max-w-[16ch] [text-wrap:balance]">
              Quanto ti resta da pagare, in ogni momento.
            </h2>
            <p className="text-sm text-(--muted) leading-relaxed max-w-[60ch]">
              Inserisci capitale, tasso e durata: WealthWatcher ricostruisce il piano di ammortamento alla
              francese e tiene il debito residuo allineato al tuo patrimonio netto.
            </p>
            <ul className="space-y-4 max-w-[60ch]">
              {[
                { icon: TrendingDown,  title: 'Capitale residuo aggiornato', text: 'Scende rata dopo rata, senza che tu debba ricalcolarlo.' },
                { icon: Landmark,      title: 'Interessi e capitale di ogni rata', text: 'Vedi quanta parte della rata è costo e quanta riduce il debito.' },
                { icon: CalendarClock, title: 'Rate nello scadenziario', text: 'Le prossime rate entrano nella proiezione di cassa.' },
              ].map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex items-start gap-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-(--surface-2) ring-1 ring-(--border)">
                    <Icon className="size-4 text-(--muted)" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-(--ink)">{title}</span>
                    <span className="block text-sm text-(--muted)">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-(--surface-2)/60 ring-1 ring-(--border) p-5 sm:p-6 self-start">
            <h3 className="text-sm font-semibold text-(--ink) mb-4">Aggiungi il tuo mutuo</h3>
            <MortgageForm accounts={accounts} />
          </div>
        </HeroShell>
      </main>
    )
  }

  return (
    <>
    <StickyBar watchId="mutui-remaining">
      <span className="text-sm font-medium text-(--ink)">Mutui</span>
      <span className="text-sm text-(--muted)">
        Capitale residuo <span className="font-mono tabular-nums font-semibold text-(--ink)">{fmtEur(totalRemaining)}</span>
      </span>
      {nextPayment && (
        <span className="ml-auto text-xs text-(--muted)">
          Prossima rata {fmtDay(nextPayment.next!.date)}
        </span>
      )}
    </StickyBar>
    <main className={`${PAGE_SHELL} space-y-8`}>
      <PageHeader
        breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Mutui' }]}
        title="Mutui"
        description="Piano di ammortamento alla francese e monitoraggio del capitale residuo."
      />

      {/* ── Hero: quanto devo ancora, quanto pago al mese, quando finisce ─── */}
      <HeroShell innerClassName="grid gap-x-14 gap-y-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end p-6 sm:p-8">
        <div className="space-y-5 min-w-0">
          <Eyebrow>Capitale residuo</Eyebrow>
          <p id="mutui-remaining" className="text-5xl sm:text-6xl font-extrabold font-display tabular-nums leading-none tracking-[-0.03em] text-(--ink)">
            {fmtEur(totalRemaining)}
          </p>
          <div className="space-y-2 max-w-xl">
            <ProgressBar value={totalInitial - totalRemaining} max={totalInitial} color="var(--ink)" />
            <p className="text-sm text-(--muted)">
              Rimborsato il <span className="font-mono tabular-nums text-(--ink)">{repaidPct}%</span> di{' '}
              <span className="font-mono tabular-nums text-(--ink)">{fmtEur(totalInitial, 0)}</span> erogati
              {mortgages.length > 1 && <> su {mortgages.length} mutui</>}.
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-10 gap-y-6 border-t border-(--border) pt-5 xl:border-t-0 xl:pt-0 xl:border-l xl:pl-14">
          <div className="space-y-1.5">
            <dt className="text-xs font-medium text-(--muted)">Rate al mese</dt>
            <dd className={KEY}>{fmtEur(totalMonthly)}</dd>
          </div>
          <div className="space-y-1.5">
            <dt className="text-xs font-medium text-(--muted)">Prossima rata</dt>
            <dd className={KEY}>{nextPayment ? fmtDay(nextPayment.next!.date) : '—'}</dd>
            {nextPayment && mortgages.length > 1 && <dd className="text-xs text-(--muted) truncate">{nextPayment.m.name}</dd>}
          </div>
          <div className="space-y-1.5">
            <dt className="text-xs font-medium text-(--muted)">Ultima rata</dt>
            <dd className={KEY}>{lastEnd ? fmtDay(lastEnd) : '—'}</dd>
          </div>
        </dl>
      </HeroShell>

      {/* ── I mutui, uno per uno ──────────────────────────────────────────── */}
      <AddSection
        title="I tuoi mutui"
        icon={<Home className="size-4 text-(--muted)" strokeWidth={1.75} />}
        addLabel="Aggiungi mutuo"
        form={<Card className="max-w-xl"><MortgageForm accounts={accounts} /></Card>}
      >
        <div className="flex flex-wrap gap-4">
          {rows.map(({ m, R, status, next, totalDue }) => {
            const rateDisplay = (parseFloat(m.annual_interest_rate) * 100).toLocaleString('it-IT', { maximumFractionDigits: 3 })
            return (
              <Card key={m.id} noPadding className="flex-1 basis-[30rem] min-w-0 flex flex-col overflow-hidden">
                <div className="flex items-start justify-between gap-3 p-4 sm:p-5 pb-0 sm:pb-0">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-(--ink) truncate">{m.name}</h3>
                    <p className="text-xs text-(--muted) mt-0.5">
                      {m.duration_months} mesi · {rateDisplay}% annuo · dal {fmtDay(m.start_date)}
                    </p>
                  </div>
                  <ConfirmDelete
                    action={deleteMortgageAction.bind(null, m.id)}
                    label="Elimina"
                    confirmText={`Eliminare il mutuo "${m.name}"?`}
                  />
                </div>

                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-4 sm:p-5">
                  <div className="space-y-1">
                    <dt className="text-xs font-medium text-(--muted)">Capitale residuo</dt>
                    <dd className="text-xl font-medium font-mono tabular-nums leading-none text-(--ink)">{fmtEur(status.remainingCapitalMinor)}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs font-medium text-(--muted)">Rata mensile</dt>
                    <dd className="text-xl font-medium font-mono tabular-nums leading-none text-(--ink)">{fmtEur(R)}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs font-medium text-(--muted)">di cui interessi</dt>
                    <dd className="text-sm font-mono tabular-nums text-(--ink)">{fmtEur(status.currentRateInterest)}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs font-medium text-(--muted)">di cui capitale</dt>
                    <dd className="text-sm font-mono tabular-nums text-(--ink)">{fmtEur(status.currentRatePrincipal)}</dd>
                  </div>
                </dl>

                <div className="px-4 sm:px-5 pb-4 space-y-1.5">
                  <ProgressBar value={status.totalPaidMinor} max={totalDue} color="var(--ink)" />
                  <p className="text-xs text-(--muted)">
                    Versato <span className="font-mono tabular-nums">{fmtEur(status.totalPaidMinor, 0)}</span> su{' '}
                    <span className="font-mono tabular-nums">{fmtEur(totalDue, 0)}</span> ({status.percentagePaid}%)
                    {next && <> · prossima rata {fmtDay(next.date)}</>}
                  </p>
                </div>

                <Link
                  href={`/dashboard/mutui/${m.id}`}
                  className="group mt-auto flex items-center justify-between gap-3 border-t border-(--border) px-4 sm:px-5 py-3 text-sm font-medium text-(--ink) hover:bg-(--surface-2) active:bg-(--surface-2) transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--ring)"
                >
                  Piano di ammortamento
                  <ChevronRight className="size-4 text-(--faint) transition-[color,transform] duration-200 ease-out-strong group-hover:text-(--ink) group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </Card>
            )
          })}
        </div>
      </AddSection>
    </main>
    </>
  )
}
