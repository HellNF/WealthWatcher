'use client'

import { Plus } from 'lucide-react'
import type { DeadlineEvent } from '@/lib/calendar'
import EventRow from './EventRow'
import { fmtFull, fmtEur } from './eventMeta'

interface Props {
  date:        string
  events:      DeadlineEvent[]
  today:       string
  onAddEvent:  (date: string) => void
}

/** Netto cash del giorno (entrate − uscite). */
function dayNet(events: DeadlineEvent[]): number {
  return events.reduce((s, e) => {
    if (e.kind !== 'cash') return s
    return s + (e.direction === 'in' ? e.amountMinor : -e.amountMinor)
  }, 0)
}

export default function DayDetailPanel({ date, events, today, onAddEvent }: Props) {
  const net = dayNet(events)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-2 px-4 py-3.5 border-b border-[--border] bg-[--surface-2]">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[--ink]">{fmtFull(date)}</p>
          <p className="text-[11px] text-[--muted] mt-0.5">
            {events.length === 0
              ? 'Nessuna scadenza'
              : `${events.length} ${events.length === 1 ? 'voce' : 'voci'}${net !== 0 ? ` · ${net >= 0 ? '+' : '−'}${fmtEur(Math.abs(net))}` : ''}`}
          </p>
        </div>
        <button
          onClick={() => onAddEvent(date)}
          className="flex size-6 shrink-0 items-center justify-center rounded-lg text-[--muted] hover:text-[--ink] hover:bg-[--surface] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
          aria-label="Aggiungi evento in questa data"
          title="Aggiungi evento"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      {events.length > 0 ? (
        <div className="flex-1 overflow-y-auto divide-y divide-[--border]">
          {events.map((e, i) => (
            <EventRow key={`${e.source}-${e.id ?? i}`} event={e} today={today} showDate={false} />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-5 py-10">
          <p className="text-xs text-[--faint] text-center leading-relaxed">
            Nessuna scadenza in questa data.
          </p>
          <button
            onClick={() => onAddEvent(date)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-dashed border-[--border] text-[--muted] hover:text-[--ink] hover:border-[--brand] hover:bg-[--brand-subtle] transition-colors"
          >
            <Plus className="size-3" /> Aggiungi evento
          </button>
        </div>
      )}
    </div>
  )
}
