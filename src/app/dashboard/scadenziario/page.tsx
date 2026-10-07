import { requireUser } from '@/lib/dal'
import { buildScadenziario } from '@/lib/calendar'
import { formatMoney } from '@/lib/money'
import { Card, Badge, Eyebrow, HeroShell, InsightCard, PageHeader, StickyBar, PAGE_SHELL } from '@/components/ui'
import { AlertTriangle } from 'lucide-react'
import ScadenziarioView from './ScadenziarioView'
import { metaFor, countdownLabel, fmtEur as fmtEvt } from './eventMeta'
import CashProjectionChart from './CashProjectionChart'

export const dynamic = 'force-dynamic'

const HORIZON_DAYS = 90

function fmtEur(minor: number) {
  return formatMoney(minor, 'EUR')
}

const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
function fmtDayMonth(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${parseInt(d, 10)} ${MONTHS_SHORT[parseInt(m, 10) - 1]}`
}

const STATUS_META = {
  OK:                { badge: 'success' as const, label: 'Liquidità solida' },
  WARNING:           { badge: 'warning' as const, label: 'Margine ridotto' },
  CRITICAL_SHORTAGE: { badge: 'danger'  as const, label: 'Rischio scoperto' },
}

export default async function ScadenziarioPage() {
  const user  = await requireUser()
  const today = new Date().toISOString().slice(0, 10)
  const year  = parseInt(today.slice(0, 4), 10)

  // Range ampio per agenda/calendario; la proiezione usa l'orizzonte di 90 giorni.
  const from = `${year}-01-01`
  const to   = `${year + 1}-12-31`

  const { events, insights, projection, summary } = await buildScadenziario(user.id, from, to, HORIZON_DAYS)
  const status = STATUS_META[summary.status]
  const minBelowStart = summary.minBalanceMinor < summary.cashStartMinor

  // In arrivo: le prossime scadenze con data da oggi in poi (già ordinate per data)
  const upcoming = events.filter((e) => e.date >= today).slice(0, 4)
  const statusTone = summary.status === 'CRITICAL_SHORTAGE' ? 'text-(--danger-text)'
    : summary.status === 'WARNING' ? 'text-(--warning-text)'
    : 'text-(--ink)'

  return (
    <>
    <StickyBar watchId="scad-min-balance">
      <span className="text-sm font-medium text-(--ink)">Scadenziario</span>
      <span className="text-sm text-(--muted)">
        Saldo minimo{' '}
        <span className={`font-mono tabular-nums font-semibold ${statusTone}`}>{fmtEur(summary.minBalanceMinor)}</span>
        {minBelowStart && <> il {fmtDayMonth(summary.minBalanceDate)}</>}
      </span>
      <span className="ml-auto text-xs text-(--muted)">{status.label}</span>
    </StickyBar>
    <main className={`${PAGE_SHELL} space-y-8`}>
      <PageHeader
        breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Scadenziario' }]}
        title="Scadenziario"
        description="Tutto ciò che sta per muovere la tua liquidità: imposte, rate, addebiti ricorrenti, entrate attese e opportunità fiscali, con la proiezione di cassa."
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem] min-[131rem]:grid-cols-[minmax(0,1fr)_30rem] gap-x-8 2xl:gap-x-10 gap-y-8 xl:items-stretch">

        {/* ── Hero: reggo i prossimi 90 giorni? ──────────────────────────── */}
        <HeroShell>
          <div className="grid gap-x-14 gap-y-8 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-end p-6 sm:p-8 pb-4 sm:pb-4">
            <div className="space-y-4 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Eyebrow>Prossimi {summary.horizonDays} giorni</Eyebrow>
                {summary.status === 'OK'
                  ? <span className="text-xs text-(--muted)">{status.label}</span>
                  : (
                    <Badge variant={status.badge}>
                      <AlertTriangle className="size-3" strokeWidth={2} aria-hidden />
                      {status.label}
                    </Badge>
                  )}
              </div>
              <div className="space-y-2">
                <p
                  id="scad-min-balance"
                  className={`text-5xl sm:text-6xl font-extrabold font-display tabular-nums leading-none tracking-[-0.03em] ${statusTone}`}
                >
                  {fmtEur(summary.minBalanceMinor)}
                </p>
                <p className="text-sm text-(--muted) max-w-[60ch]">
                  {summary.status === 'CRITICAL_SHORTAGE' ? (
                    <>
                      La liquidità proiettata scende sotto zero intorno al{' '}
                      <strong className="text-(--ink)">{fmtDayMonth(summary.minBalanceDate)}</strong>: anticipa entrate o rimanda alcune uscite.
                    </>
                  ) : minBelowStart ? (
                    <>È il punto più basso a cui scende la tua liquidità, il <strong className="text-(--ink)">{fmtDayMonth(summary.minBalanceDate)}</strong>.</>
                  ) : (
                    <>La tua liquidità non scende mai sotto il livello di oggi.</>
                  )}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 sm:gap-x-10 gap-y-5 border-t border-(--border) pt-5 2xl:border-t-0 2xl:pt-0 2xl:border-l 2xl:pl-14">
              <div className="space-y-1.5">
                <dt className="text-xs font-medium text-(--muted)">Liquidità oggi</dt>
                <dd className="text-xl sm:text-2xl font-extrabold font-display tabular-nums leading-none tracking-[-0.02em] text-(--ink)">{fmtEur(summary.cashStartMinor)}</dd>
              </div>
              <div className="space-y-1.5">
                <dt className="text-xs font-medium text-(--muted)">Uscite attese</dt>
                <dd className="text-xl sm:text-2xl font-extrabold font-display tabular-nums leading-none tracking-[-0.02em] text-(--ink)">{fmtEur(summary.outflowMinor)}</dd>
              </div>
              <div className="space-y-1.5">
                <dt className="text-xs font-medium text-(--muted)">Entrate attese</dt>
                <dd className="text-xl sm:text-2xl font-extrabold font-display tabular-nums leading-none tracking-[-0.02em] text-(--ink)">{fmtEur(summary.inflowMinor)}</dd>
              </div>
            </dl>
          </div>

          {/* Proiezione di cassa */}
          <div className="flex-1 flex flex-col gap-3 px-6 sm:px-8 pb-5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-(--ink)">Proiezione di cassa</h2>
              <div className="flex items-center gap-3 text-xs text-(--muted)">
                <span className="inline-flex items-center gap-1.5"><span className="inline-block w-3 border-t border-dashed border-(--muted)" aria-hidden /> soglia di allerta</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-(--muted)" aria-hidden /> uscita</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-(--brand)" aria-hidden /> entrata</span>
              </div>
            </div>
            <div className="relative h-[240px] xl:h-auto xl:flex-1 xl:min-h-[240px]">
              <div className="absolute inset-0">
                <CashProjectionChart
                  points={projection}
                  thresholdMinor={summary.thresholdMinor}
                  minDate={summary.minBalanceDate}
                />
              </div>
            </div>
            <p className="text-xs text-(--muted) leading-relaxed max-w-[110ch]">
              Stima: parte dalla media dei tuoi movimenti e vi sovrappone le scadenze non ricorrenti
              (imposte, rate, eventi manuali, dividendi e interessi stimati).
            </p>
          </div>
        </HeroShell>

        {/* ── Colonna laterale: cosa arriva e cosa sapere ────────────────── */}
        <aside className="min-w-0 flex flex-col gap-6">
          <section className="flex-1 flex flex-col gap-2.5">
            <h2 className="px-1 text-sm font-semibold text-(--ink)">In arrivo</h2>
            <Card noPadding className="flex-1 overflow-hidden divide-y divide-(--border)">
              {upcoming.length === 0 ? (
                <p className="p-5 text-sm text-(--muted)">Nessuna scadenza in vista.</p>
              ) : upcoming.map((e, i) => {
                const meta = metaFor(e.source)
                const Icon = meta.icon
                return (
                  <div key={`${e.source}-${e.date}-${e.id ?? i}`} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-(--surface-2) ring-1 ring-(--border)">
                      <Icon className="size-4 text-(--muted)" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-(--ink) truncate">{e.label}</span>
                      <span className="block text-xs text-(--muted)">{fmtDayMonth(e.date)} · {countdownLabel(e.date, today)}</span>
                    </span>
                    {e.amountMinor > 0 && (
                      <span className={`shrink-0 text-sm font-mono tabular-nums ${e.kind === 'cash' && e.direction === 'in' ? 'text-(--brand-text)' : 'text-(--ink)'}`}>
                        {e.kind === 'cash' ? (e.direction === 'in' ? '+' : '−') : ''}{fmtEvt(e.amountMinor)}
                      </span>
                    )}
                  </div>
                )
              })}
            </Card>
          </section>

          {insights.map((ins) => (
            <InsightCard key={ins.id} insight={ins} linkLabel="Vai" />
          ))}
        </aside>
      </div>

      {/* ── Agenda ⇄ Calendario ──────────────────────────────────────────── */}
      <ScadenziarioView events={events} today={today} />
    </main>
    </>
  )
}
