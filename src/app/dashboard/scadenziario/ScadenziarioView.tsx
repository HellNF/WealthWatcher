'use client'

import { useState } from 'react'
import { Segmented } from '@/components/ui/Segmented'
import { CalendarDays, ListChecks, Plus } from 'lucide-react'
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
    <section className="space-y-5">
      {/* Toolbar: toggle vista + aggiungi */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Segmented
          label="Vista"
          value={view}
          onChange={setView}
          options={[
            { value: 'agenda',   label: 'Agenda',     icon: ListChecks },
            { value: 'calendar', label: 'Calendario', icon: CalendarDays },
          ]}
        />

        <button
          onClick={() => openForm(today)}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 text-sm font-medium rounded-lg border border-(--border) text-(--ink) hover:bg-(--surface-2) active:scale-[0.97] transition-[transform,scale,translate,background-color] duration-150 ease-out-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--ring)"
        >
          <Plus className="size-4" strokeWidth={1.75} /> Aggiungi evento
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
