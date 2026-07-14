import { requireUser } from '@/lib/dal'
import { buildScadenziario } from '@/lib/calendar'
import { fromMinor } from '@/lib/money'
import { Breadcrumb, Card, Stat, Badge } from '@/components/ui'
import { AlertTriangle, TrendingDown } from 'lucide-react'
import ScadenziarioView from './ScadenziarioView'
import InsightCards from './InsightCards'
import CashProjectionChart from './CashProjectionChart'

export const dynamic = 'force-dynamic'

const HORIZON_DAYS = 90

function fmtEur(minor: number) {
  return fromMinor(minor, 'EUR')
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

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Scadenziario' },
      ]} />

      <div>
        <h1 className="text-xl font-semibold text-[--ink]">Scadenziario</h1>
        <p className="text-sm text-[--muted] mt-0.5">
          Tutto ciò che sta per muovere la tua liquidità — imposte, rate, addebiti ricorrenti,
          dividendi attesi e opportunità fiscali — letto insieme, con proiezione di cassa e avvisi.
        </p>
      </div>

      {/* ── Hero: prossimi 90 giorni ─────────────────────────────────────── */}
      <Card
        noPadding
        className={
          summary.status === 'CRITICAL_SHORTAGE' ? 'border-[--danger]' :
          summary.status === 'WARNING'           ? 'border-[--warning]' : ''
        }
      >
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2">
            {summary.status !== 'OK' && (
              <AlertTriangle className={`size-4 ${summary.status === 'CRITICAL_SHORTAGE' ? 'text-[--danger]' : 'text-[--warning]'}`} />
            )}
            <h2 className="text-sm font-semibold text-[--ink]">Prossimi {summary.horizonDays} giorni</h2>
            <Badge variant={status.badge}>{status.label}</Badge>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Liquidità libera oggi" value={fmtEur(summary.cashStartMinor)} size="sm" />
            <Stat label="Uscite attese"  value={fmtEur(summary.outflowMinor)} size="sm" />
            <Stat label="Entrate attese"  value={fmtEur(summary.inflowMinor)}  size="sm" />
            <Stat
              label="Saldo minimo proiettato"
              value={fmtEur(summary.minBalanceMinor)}
              size="sm"
              sub={minBelowStart ? `il ${fmtDayMonth(summary.minBalanceDate)}` : undefined}
            />
          </div>

          {summary.status === 'CRITICAL_SHORTAGE' && (
            <p className="text-sm text-[--danger]">
              La liquidità proiettata scende sotto zero intorno al{' '}
              <strong>{fmtDayMonth(summary.minBalanceDate)}</strong>. Anticipa entrate o rimanda alcune uscite.
            </p>
          )}
        </div>

        {/* Proiezione di cassa */}
        <div className="border-t border-[--border] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <TrendingDown className="size-4 text-[--muted]" strokeWidth={1.75} />
              <h3 className="text-sm font-semibold text-[--ink]">Proiezione di cassa</h3>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[--muted]">
              <span className="inline-flex items-center gap-1"><span className="inline-block w-3 border-t border-dashed border-[--warning]" /> soglia allerta</span>
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-[--danger]" /> uscita</span>
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-[--brand]" /> entrata</span>
            </div>
          </div>
          <CashProjectionChart
            points={projection}
            thresholdMinor={summary.thresholdMinor}
            minDate={summary.minBalanceDate}
          />
          <p className="text-xs text-[--faint] leading-relaxed">
            Stima euristica: deriva la spesa ordinaria dalla media dei movimenti e vi sovrappone le
            scadenze non ricorrenti (imposte, rate, eventi manuali, dividendi e interessi stimati).
          </p>
        </div>
      </Card>

      {/* ── Insight & opportunità ────────────────────────────────────────── */}
      {insights.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-[--ink]">Cosa dovresti sapere</h2>
            <p className="text-sm text-[--muted] mt-0.5">Considerazioni estratte dai tuoi dati, ordinate per rilevanza.</p>
          </div>
          <InsightCards insights={insights} />
        </section>
      )}

      {/* ── Agenda ⇄ Calendario ──────────────────────────────────────────── */}
      <ScadenziarioView events={events} today={today} />
    </main>
  )
}
