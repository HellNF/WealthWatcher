'use client'

import { CalendarClock } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import type { DeadlineEvent } from '@/lib/calendar'
import EventRow from './EventRow'
import { daysUntil, fmtEur } from './eventMeta'

interface Bucket {
  key:   string
  label: string
  test:  (d: number) => boolean
}

// Bucket temporali (in giorni da oggi). L'ordine definisce la sequenza visiva.
const BUCKETS: Bucket[] = [
  { key: 'overdue', label: 'In ritardo',      test: (d) => d < 0 },
  { key: 'week',    label: 'Questa settimana', test: (d) => d >= 0 && d <= 7 },
  { key: 'month',   label: 'Questo mese',      test: (d) => d > 7 && d <= 30 },
  { key: 'quarter', label: 'Prossimi 3 mesi',  test: (d) => d > 30 && d <= 90 },
  { key: 'later',   label: 'Più avanti',       test: (d) => d > 90 },
]

/** Netto cash del bucket (entrate − uscite), per l'etichetta di riepilogo. */
function bucketNet(events: DeadlineEvent[]): number {
  return events.reduce((s, e) => {
    if (e.kind !== 'cash') return s
    return s + (e.direction === 'in' ? e.amountMinor : -e.amountMinor)
  }, 0)
}

interface Props {
  events: DeadlineEvent[]
  today:  string
}

export default function AgendaView({ events, today }: Props) {
  // Ignora eventi troppo vecchi (oltre 60 giorni fa) per non allungare la lista
  const relevant = events.filter(e => daysUntil(e.date, today) >= -60)

  if (relevant.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Nessuna scadenza in vista"
        description="Non ci sono eventi rilevanti nel periodo. Aggiungine uno manuale per tenerlo d'occhio."
      />
    )
  }

  const grouped = BUCKETS.map(b => ({
    ...b,
    items: relevant.filter(e => b.test(daysUntil(e.date, today))),
  })).filter(g => g.items.length > 0)

  return (
    <div className="space-y-6">
      {grouped.map(g => {
        const net = bucketNet(g.items)
        return (
          <section key={g.key}>
            <div className="flex items-baseline justify-between gap-3 px-1 pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[--muted]">
                {g.label}
                <span className="ml-2 text-[--faint] font-normal normal-case tracking-normal">
                  {g.items.length} {g.items.length === 1 ? 'evento' : 'eventi'}
                </span>
              </h3>
              {net !== 0 && (
                <span className={`text-xs font-mono tabular-nums ${net >= 0 ? 'text-[--brand-text]' : 'text-[--muted]'}`}>
                  {net >= 0 ? '+' : '−'}{fmtEur(Math.abs(net))}
                </span>
              )}
            </div>
            <div className="rounded-2xl border border-[--border] bg-[--surface] divide-y divide-[--border] overflow-hidden">
              {g.items.map((e, i) => (
                <EventRow key={`${e.source}-${e.date}-${e.id ?? i}`} event={e} today={today} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
