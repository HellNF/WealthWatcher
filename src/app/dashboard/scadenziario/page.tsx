import { requireUser } from '@/lib/dal'
import { getFiscalCalendar } from '@/lib/calendar'
import { cashRunwayAlert } from '@/lib/alerts/liquidity'
import { fromMinor } from '@/lib/money'
import { Breadcrumb, Card, Stat, Badge } from '@/components/ui'
import { AlertTriangle } from 'lucide-react'
import CalendarView from './CalendarView'

export const dynamic = 'force-dynamic'

function fmtEur(minor: number) {
  return fromMinor(minor, 'EUR')
}

export default async function ScadenziarioPage() {
  const user  = await requireUser()
  const today = new Date().toISOString().slice(0, 10)
  const year  = parseInt(today.slice(0, 4), 10)

  // Carica tutto l'anno corrente + l'anno prossimo per navigazione libera
  const from = `${year}-01-01`
  const to   = `${year + 1}-12-31`

  const [events, runway] = await Promise.all([
    getFiscalCalendar(user.id, from, to),
    cashRunwayAlert(user.id),
  ])

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Scadenziario' },
      ]} />

      <div>
        <h1 className="text-xl font-semibold text-[--ink]">Scadenziario fiscale e patrimoniale</h1>
        <p className="text-sm text-[--muted] mt-0.5">
          Scadenze aggregate da bollo, IVAFE, zainetto fiscale, rate mutuo e pagamenti ricorrenti.
        </p>
      </div>

      {/* Stress test liquidità */}
      <Card className={
        runway.status === 'CRITICAL_SHORTAGE' ? 'border-[--danger]' :
        runway.status === 'WARNING'           ? 'border-[--warning]' : ''
      }>
        <div className="flex items-start gap-3">
          {runway.status !== 'OK' && (
            <AlertTriangle
              className={`size-5 mt-0.5 shrink-0 ${
                runway.status === 'CRITICAL_SHORTAGE' ? 'text-[--danger]' : 'text-[--warning]'
              }`}
            />
          )}
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[--ink]">Stress test liquidità — 60 giorni</h2>
              <Badge variant={
                runway.status === 'CRITICAL_SHORTAGE' ? 'danger' :
                runway.status === 'WARNING'           ? 'warning' : 'success'
              }>
                {runway.status === 'CRITICAL_SHORTAGE' ? 'Rischio scoperto' :
                 runway.status === 'WARNING'           ? 'Margine ridotto'  : 'OK'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Liquidità libera oggi"  value={fmtEur(runway.cashStartMinor)}           size="sm" />
              <Stat label="Entrate attese"          value={fmtEur(runway.incomeExpectedMinor)}      size="sm" />
              <Stat label="Uscite schedulate"       value={fmtEur(runway.outflowsScheduledMinor)}   size="sm" />
              <Stat
                label="Minimo stimato"
                value={fmtEur(runway.lowestEstimatedCashMinor)}
                size="sm"
                sub={runway.status === 'CRITICAL_SHORTAGE'
                  ? `deficit ${fmtEur(runway.deficitMinor)}`
                  : undefined}
              />
            </div>

            {runway.status === 'CRITICAL_SHORTAGE' && (
              <p className="text-sm text-[--danger]">
                Rischio scoperto entro {runway.windowDays} giorni. Deficit stimato:{' '}
                <strong>{fmtEur(runway.deficitMinor)}</strong>.
                Considera di ridurre le allocazioni agli obiettivi o di posticipare alcune uscite.
              </p>
            )}

            <p className="text-xs text-[--faint]">
              Stima euristica basata su media entrate ultimi 6 mesi + uscite schedulate nel calendario.
              Non considera variazioni impreviste di liquidità.
            </p>
          </div>
        </div>
      </Card>

      {/* Calendario navigabile */}
      <CalendarView
        events={events}
        today={today}
        initialMonth={today.slice(0, 7)}
      />
    </main>
  )
}
