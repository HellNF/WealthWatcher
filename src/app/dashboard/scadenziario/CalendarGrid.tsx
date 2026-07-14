'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { DeadlineEvent } from '@/lib/calendar'
import DayDetailPanel from './DayDetailPanel'
import { metaFor, MONTHS_IT } from './eventMeta'

const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

function stepMonth(year: number, month: number, delta: number): string {
  const d = new Date(year, month - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Griglia 7 colonne, settimana Lun-first, con celle di riempimento. */
function buildGrid(year: number, month: number): string[][] {
  const totalDays = new Date(year, month, 0).getDate()
  const prevLast  = new Date(year, month - 1, 0).getDate()
  const startDow  = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const pm = month === 1 ? 12 : month - 1, py = month === 1 ? year - 1 : year
  const nm = month === 12 ? 1 : month + 1, ny = month === 12 ? year + 1 : year
  const cells: string[] = []
  for (let i = startDow - 1; i >= 0; i--) cells.push(`${py}-${String(pm).padStart(2, '0')}-${String(prevLast - i).padStart(2, '0')}`)
  for (let d = 1; d <= totalDays; d++) cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  for (let d = 1, rem = (7 - (cells.length % 7)) % 7; d <= rem; d++) cells.push(`${ny}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  const weeks: string[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

interface Props {
  events:       DeadlineEvent[]
  today:        string   // YYYY-MM-DD
  onAddEvent:   (date: string) => void
}

export default function CalendarGrid({ events, today, onAddEvent }: Props) {
  const [currentMonth, setCurrentMonth] = useState(today.slice(0, 7))
  const [selectedDate, setSelectedDate] = useState<string>(today)
  const [cy, cm] = currentMonth.split('-').map(Number)

  const byDate = useMemo(() => {
    const m = new Map<string, DeadlineEvent[]>()
    for (const e of events) {
      const list = m.get(e.date) ?? []
      list.push(e)
      m.set(e.date, list)
    }
    return m
  }, [events])

  const weeks = useMemo(() => buildGrid(cy, cm), [cy, cm])
  const isCurrentMonth = currentMonth === today.slice(0, 7)
  const selEvents = byDate.get(selectedDate) ?? []

  function goMonth(delta: number) { setCurrentMonth(stepMonth(cy, cm, delta)) }
  function handleDayClick(date: string) {
    if (date.slice(0, 7) !== currentMonth) setCurrentMonth(date.slice(0, 7))
    setSelectedDate(date)
  }

  return (
    <div
      className="flex flex-col sm:flex-row rounded-2xl border border-[--border] bg-[--surface] overflow-hidden"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      {/* ── Griglia ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-1 px-4 py-3 border-b border-[--border]">
          <button
            onClick={() => goMonth(-1)} aria-label="Mese precedente"
            className="size-7 flex items-center justify-center rounded-lg text-[--muted] hover:text-[--ink] hover:bg-[--surface-2] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
          >
            <ChevronLeft className="size-3.5" strokeWidth={2.5} />
          </button>
          <h3 className="flex-1 text-center text-sm font-semibold text-[--ink] select-none">
            {MONTHS_IT[cm - 1]} {cy}
          </h3>
          <button
            onClick={() => goMonth(1)} aria-label="Mese successivo"
            className="size-7 flex items-center justify-center rounded-lg text-[--muted] hover:text-[--ink] hover:bg-[--surface-2] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
          >
            <ChevronRight className="size-3.5" strokeWidth={2.5} />
          </button>
          {!isCurrentMonth && (
            <button
              onClick={() => { setCurrentMonth(today.slice(0, 7)); setSelectedDate(today) }}
              className="ml-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-[--brand-subtle] text-[--brand-text] hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
            >
              Oggi
            </button>
          )}
        </div>

        <div className="grid grid-cols-7 border-b border-[--border]">
          {DAYS_SHORT.map((d, i) => (
            <div key={d} className={`py-2 text-center text-[10px] font-semibold uppercase tracking-wider select-none ${i >= 5 ? 'text-[--faint]' : 'text-[--muted]'}`}>
              {d}
            </div>
          ))}
        </div>

        <div className="flex-1">
          {weeks.map((week, wi) => (
            <div key={wi} className={`grid grid-cols-7${wi < weeks.length - 1 ? ' border-b border-[--border]' : ''}`}>
              {week.map((date, di) => {
                const inMonth = date.startsWith(currentMonth)
                const isToday = date === today
                const isSel   = date === selectedDate
                const dayEvts = byDate.get(date) ?? []
                const dayNum  = parseInt(date.split('-')[2], 10)
                const weekend = di >= 5
                const numCls = isToday
                  ? 'bg-[--brand] text-white'
                  : isSel ? 'text-[--brand]'
                  : inMonth ? (weekend ? 'text-[--faint]' : 'text-[--ink]') : 'text-[--faint] opacity-40'
                return (
                  <button
                    key={date}
                    onClick={() => handleDayClick(date)}
                    aria-pressed={isSel || undefined}
                    className={[
                      'flex flex-col items-center gap-0.5 py-2.5 min-h-[52px] transition-colors',
                      'focus-visible:outline-none focus-visible:z-10 focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-[--ring]',
                      di > 0 ? 'border-l border-[--border]' : '',
                      isSel && !isToday ? 'bg-[--brand-subtle]' : '',
                      inMonth ? 'hover:bg-[--surface-2] cursor-pointer' : 'cursor-default',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className={`size-6 sm:size-7 flex items-center justify-center rounded-full text-xs font-medium tabular-nums leading-none ${numCls}`}>
                      {dayNum}
                    </span>
                    {dayEvts.length > 0 && (
                      <div className="flex items-center gap-px">
                        {dayEvts.slice(0, 3).map((e, i) => (
                          <span key={i} className="size-1 rounded-full"
                            style={{ background: isToday ? 'rgba(255,255,255,0.75)' : metaFor(e.source).dot }} />
                        ))}
                        {dayEvts.length > 3 && <span className="text-[8px] text-[--faint] leading-none ml-0.5">+{dayEvts.length - 3}</span>}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Dettaglio giorno (unico: side-panel su sm+, sotto su mobile) ─── */}
      <aside className="w-full sm:w-72 shrink-0 border-t sm:border-t-0 sm:border-l border-[--border]" aria-label="Dettaglio giorno">
        <DayDetailPanel date={selectedDate} events={selEvents} today={today} onAddEvent={onAddEvent} />
      </aside>
    </div>
  )
}
