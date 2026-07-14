'use client'

import { useState } from 'react'
import { CalendarDays, ListChecks, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { DeadlineEvent } from '@/lib/calendar'
import AgendaView from './AgendaView'
import CalendarGrid from './CalendarGrid'
import EventForm from './EventForm'

type ViewMode = 'agenda' | 'calendar'

interface Props {
  events: DeadlineEvent[]
  today:  string
}

export default function ScadenziarioView({ events, today }: Props) {
  const [view, setView] = useState<ViewMode>('agenda')
  const [formDate, setFormDate] = useState<string | null>(null)

  function openForm(date: string) { setFormDate(date) }

  return (
    <section className="space-y-4">
      {/* Toolbar: toggle vista + aggiungi */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[--surface-2] border border-[--border]">
          {([
            { key: 'agenda',   label: 'Agenda',     icon: ListChecks },
            { key: 'calendar', label: 'Calendario', icon: CalendarDays },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              aria-pressed={view === key}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]',
                view === key ? 'bg-[--surface] text-[--ink] shadow-[var(--shadow-sm)]' : 'text-[--muted] hover:text-[--ink]',
              )}
            >
              <Icon className="size-3.5" strokeWidth={1.75} /> {label}
            </button>
          ))}
        </div>

        <button
          onClick={() => openForm(today)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[--border] text-[--ink] hover:bg-[--surface-2] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
        >
          <Plus className="size-3.5" strokeWidth={2} /> Aggiungi evento
        </button>
      </div>

      {formDate && (
        <EventForm defaultDate={formDate} onClose={() => setFormDate(null)} />
      )}

      {view === 'agenda'
        ? <AgendaView events={events} today={today} />
        : <CalendarGrid events={events} today={today} onAddEvent={openForm} />}
    </section>
  )
}
