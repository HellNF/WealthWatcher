'use client'

import { useState } from 'react'
import { motion, LayoutGroup, useReducedMotion } from 'motion/react'
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
  const reduceMotion = useReducedMotion()

  function openForm(date: string) { setFormDate(date) }

  return (
    <section className="space-y-5">
      {/* Toolbar: toggle vista + aggiungi */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <LayoutGroup id="scadenziario-view">
        <div role="radiogroup" aria-label="Vista" className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-(--surface-2)">
          {([
            { key: 'agenda',   label: 'Agenda',     icon: ListChecks },
            { key: 'calendar', label: 'Calendario', icon: CalendarDays },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              role="radio"
              aria-checked={view === key}
              className={cn(
                'relative inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md cursor-pointer select-none',
                'transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97]',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--ring)',
                view === key ? 'text-(--ink)' : 'text-(--muted) hover:text-(--ink)',
              )}
            >
              {view === key && (
                <motion.span
                  layoutId="scadenziario-view-pill"
                  className="absolute inset-0 rounded-md bg-(--surface) shadow-(--shadow-sm) ring-1 ring-(--border)"
                  transition={reduceMotion ? { duration: 0 } : { type: 'spring', duration: 0.3, bounce: 0 }}
                />
              )}
              <Icon className="relative size-4" strokeWidth={1.75} /> <span className="relative">{label}</span>
            </button>
          ))}
        </div>
        </LayoutGroup>

        <button
          onClick={() => openForm(today)}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 text-sm font-medium rounded-lg border border-(--border) text-(--ink) hover:bg-(--surface-2) active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--ring)"
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
