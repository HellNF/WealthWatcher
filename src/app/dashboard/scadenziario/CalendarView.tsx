'use client'

import { useState, useMemo } from 'react'
import type { DeadlineEvent } from '@/lib/calendar'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui'
import { fromMinor } from '@/lib/money'

// ── Design tokens per tipo di evento ──────────────────────────────────────

const SOURCE_DOT: Record<string, string> = {
  bollo:           'var(--muted)',
  ivafe:           'var(--muted)',
  credito_fiscale: 'var(--warning)',
  rata_mutuo:      'var(--info)',
  ricorrente:      'var(--brand)',
}

const SOURCE_LABELS: Record<string, string> = {
  bollo:           'Bollo',
  ivafe:           'IVAFE',
  credito_fiscale: 'Credito fiscale',
  rata_mutuo:      'Mutuo',
  ricorrente:      'Ricorrente',
}

const SOURCE_BADGE: Record<string, 'warning' | 'info' | 'neutral'> = {
  bollo:           'neutral',
  ivafe:           'neutral',
  credito_fiscale: 'warning',
  rata_mutuo:      'info',
  ricorrente:      'neutral',
}

const LEGEND: { source: string; label: string }[] = [
  { source: 'ricorrente',      label: 'Ricorrente' },
  { source: 'rata_mutuo',      label: 'Mutuo' },
  { source: 'credito_fiscale', label: 'Credito fiscale' },
  { source: 'bollo',           label: 'Bollo / IVAFE' },
]

// ── Localizzazione ─────────────────────────────────────────────────────────

const MONTHS_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]
const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const DAYS_FULL  = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtEur(minor: number) {
  return fromMinor(minor, 'EUR')
}

function fmtShort(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function fmtFull(iso: string) {
  const dt = new Date(`${iso}T00:00:00`)
  return `${DAYS_FULL[dt.getDay()]} ${dt.getDate()} ${MONTHS_IT[dt.getMonth()]} ${dt.getFullYear()}`
}

function stepMonth(year: number, month: number, delta: number): string {
  const d = new Date(year, month - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Costruisce la griglia 7-colonne con settimana Mon-first
function buildGrid(year: number, month: number): string[][] {
  const first      = new Date(year, month - 1, 1)
  const totalDays  = new Date(year, month, 0).getDate()
  const prevLast   = new Date(year, month - 1, 0).getDate()
  const startDow   = (first.getDay() + 6) % 7  // Mon=0..Sun=6

  const pm = month === 1  ? 12 : month - 1
  const py = month === 1  ? year - 1 : year
  const nm = month === 12 ? 1  : month + 1
  const ny = month === 12 ? year + 1 : year

  const cells: string[] = []

  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevLast - i
    cells.push(`${py}-${String(pm).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  for (let d = 1; d <= totalDays; d++) {
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  const rem = (7 - (cells.length % 7)) % 7
  for (let d = 1; d <= rem; d++) {
    cells.push(`${ny}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }

  const weeks: string[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

// ── Componente ─────────────────────────────────────────────────────────────

interface Props {
  events:       DeadlineEvent[]
  today:        string   // YYYY-MM-DD
  initialMonth: string   // YYYY-MM
}

export default function CalendarView({ events, today, initialMonth }: Props) {
  const [currentMonth, setCurrentMonth] = useState(initialMonth)
  const [selectedDate, setSelectedDate] = useState<string | null>(today)

  const [cy, cm] = currentMonth.split('-').map(Number)

  // Indice eventi per data
  const byDate = useMemo(() => {
    const m = new Map<string, DeadlineEvent[]>()
    for (const e of events) {
      if (!m.has(e.date)) m.set(e.date, [])
      m.get(e.date)!.push(e)
    }
    return m
  }, [events])

  const weeks = useMemo(() => buildGrid(cy, cm), [cy, cm])

  // Riepilogo mese
  const monthEvents = useMemo(
    () => events.filter(e => e.date.startsWith(currentMonth)),
    [events, currentMonth],
  )
  const monthTotal = monthEvents.reduce((s, e) => s + e.amountMinor, 0)

  // Raggruppa per data per la lista mensile
  const monthByDate = useMemo(() => {
    const m = new Map<string, DeadlineEvent[]>()
    for (const e of monthEvents) {
      if (!m.has(e.date)) m.set(e.date, [])
      m.get(e.date)!.push(e)
    }
    return m
  }, [monthEvents])

  const selEvents = selectedDate ? (byDate.get(selectedDate) ?? []) : []
  const showDayPanel = selectedDate !== null && selEvents.length > 0
  const isCurrentMonth = currentMonth === today.slice(0, 7)

  function goMonth(delta: number) {
    setCurrentMonth(stepMonth(cy, cm, delta))
  }

  function handleDayClick(date: string) {
    const m = date.slice(0, 7)
    if (m !== currentMonth) setCurrentMonth(m)
    setSelectedDate(prev => prev === date ? null : date)
  }

  return (
    <div
      className="flex flex-col sm:flex-row rounded-2xl border border-[--border] bg-[--surface] overflow-hidden"
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      {/* ── Griglia calendario ──────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Navigazione mese */}
        <div className="flex items-center gap-1 px-4 py-3 border-b border-[--border]">
          <button
            onClick={() => goMonth(-1)}
            aria-label="Mese precedente"
            className="size-7 flex items-center justify-center rounded-lg text-[--muted] hover:text-[--ink] hover:bg-[--surface-2] transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
          >
            <ChevronLeft className="size-3.5" strokeWidth={2.5} />
          </button>

          <h2 className="flex-1 text-center text-sm font-semibold text-[--ink] select-none">
            {MONTHS_IT[cm - 1]} {cy}
          </h2>

          <button
            onClick={() => goMonth(1)}
            aria-label="Mese successivo"
            className="size-7 flex items-center justify-center rounded-lg text-[--muted] hover:text-[--ink] hover:bg-[--surface-2] transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
          >
            <ChevronRight className="size-3.5" strokeWidth={2.5} />
          </button>

          {!isCurrentMonth && (
            <button
              onClick={() => { setCurrentMonth(today.slice(0, 7)); setSelectedDate(today) }}
              className="ml-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-[--brand-subtle] text-[--brand-text] hover:opacity-80 transition-opacity duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
            >
              Oggi
            </button>
          )}
        </div>

        {/* Intestazioni giorni settimana */}
        <div className="grid grid-cols-7 border-b border-[--border]">
          {DAYS_SHORT.map((d, i) => (
            <div
              key={d}
              className={`py-2 text-center text-[10px] font-semibold uppercase tracking-wider select-none
                ${i >= 5 ? 'text-[--faint]' : 'text-[--muted]'}`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Griglia giorni */}
        <div className="flex-1">
          {weeks.map((week, wi) => (
            <div
              key={wi}
              className={`grid grid-cols-7${wi < weeks.length - 1 ? ' border-b border-[--border]' : ''}`}
            >
              {week.map((date, di) => {
                const inMonth  = date.startsWith(currentMonth)
                const isToday  = date === today
                const isSel    = date === selectedDate
                const dayEvts  = byDate.get(date) ?? []
                const hasEvts  = dayEvts.length > 0
                const dayNum   = parseInt(date.split('-')[2], 10)
                const weekend  = di >= 5

                const numCls = isToday
                  ? 'bg-[--brand] text-white'
                  : isSel
                    ? 'text-[--brand]'
                    : inMonth
                      ? weekend ? 'text-[--faint]' : 'text-[--ink]'
                      : 'text-[--faint] opacity-40'

                return (
                  <button
                    key={date}
                    onClick={() => handleDayClick(date)}
                    aria-label={`${fmtFull(date)}${hasEvts ? `, ${dayEvts.length} ${dayEvts.length === 1 ? 'scadenza' : 'scadenze'}` : ''}`}
                    aria-pressed={isSel || undefined}
                    className={[
                      'flex flex-col items-center gap-0.5 py-2.5 min-h-[52px] transition-colors duration-100',
                      'focus-visible:outline-none focus-visible:z-10 focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-[--ring]',
                      di > 0 ? 'border-l border-[--border]' : '',
                      isSel && !isToday ? 'bg-[--brand-subtle]' : '',
                      hasEvts && !isSel ? 'hover:bg-[--surface-2] cursor-pointer' : 'cursor-default',
                    ].filter(Boolean).join(' ')}
                  >
                    <span
                      className={`size-6 sm:size-7 flex items-center justify-center rounded-full text-xs font-medium tabular-nums leading-none ${numCls}`}
                    >
                      {dayNum}
                    </span>

                    {hasEvts && (
                      <div className="flex items-center gap-px">
                        {dayEvts.slice(0, 3).map((e, i) => (
                          <span
                            key={i}
                            className="size-1 rounded-full"
                            style={{
                              background: isToday
                                ? 'rgba(255,255,255,0.75)'
                                : (SOURCE_DOT[e.source] ?? 'var(--muted)'),
                            }}
                          />
                        ))}
                        {dayEvts.length > 3 && (
                          <span className="text-[8px] text-[--faint] leading-none ml-0.5">
                            +{dayEvts.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="px-4 py-2.5 border-t border-[--border] flex flex-wrap gap-x-4 gap-y-1">
          {LEGEND.map(({ source, label }) => (
            <div key={source} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full shrink-0"
                style={{ background: SOURCE_DOT[source] }}
              />
              <span className="text-[10px] text-[--muted]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pannello laterale — desktop ─────────────────────────────────── */}
      <aside
        className="hidden sm:flex flex-col w-64 shrink-0 border-l border-[--border]"
        aria-label="Dettaglio scadenze"
      >
        {showDayPanel && selectedDate ? (
          <>
            <div className="px-4 py-3.5 border-b border-[--border] bg-[--surface-2]">
              <p className="text-xs font-semibold text-[--ink]">{fmtFull(selectedDate)}</p>
              <p className="text-[10px] text-[--muted] mt-0.5">
                {selEvents.length} {selEvents.length === 1 ? 'scadenza' : 'scadenze'}
                {' · '}
                {fmtEur(selEvents.reduce((s, e) => s + e.amountMinor, 0))}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-[--border]">
              {selEvents.map((e, i) => (
                <div key={i} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ background: SOURCE_DOT[e.source] ?? 'var(--muted)' }}
                    />
                    <Badge variant={SOURCE_BADGE[e.source] ?? 'neutral'}>
                      {SOURCE_LABELS[e.source] ?? e.source}
                    </Badge>
                  </div>
                  <p className="text-xs text-[--ink] leading-snug">{e.label}</p>
                  <p className="text-xs font-mono tabular-nums text-[--muted]">
                    {fmtEur(e.amountMinor)}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="px-4 py-3.5 border-b border-[--border] bg-[--surface-2]">
              <p className="text-xs font-semibold text-[--ink]">{MONTHS_IT[cm - 1]} {cy}</p>
              <p className="text-[10px] text-[--muted] mt-0.5">
                {monthEvents.length === 0
                  ? 'Nessuna scadenza'
                  : `${monthEvents.length} ${monthEvents.length === 1 ? 'scadenza' : 'scadenze'} · ${fmtEur(monthTotal)}`
                }
              </p>
            </div>

            {monthByDate.size > 0 ? (
              <div className="flex-1 overflow-y-auto divide-y divide-[--border]">
                {[...monthByDate.entries()].map(([date, evts]) => (
                  <button
                    key={date}
                    onClick={() => handleDayClick(date)}
                    className="w-full px-4 py-2.5 text-left hover:bg-[--surface-2] transition-colors duration-100 focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-[--ring]"
                  >
                    <p className="text-[10px] text-[--faint] mb-0.5">{fmtShort(date)}</p>
                    <p className="text-xs text-[--ink] truncate">
                      {evts.map(e => SOURCE_LABELS[e.source] ?? e.source).join(', ')}
                    </p>
                    <p className="text-xs font-mono tabular-nums text-[--muted] mt-0.5">
                      {fmtEur(evts.reduce((s, e) => s + e.amountMinor, 0))}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center px-5">
                <p className="text-xs text-[--faint] text-center leading-relaxed">
                  Seleziona un giorno per vedere le scadenze
                </p>
              </div>
            )}
          </>
        )}
      </aside>

      {/* ── Dettaglio giorno — mobile (sotto il calendario) ─────────────── */}
      {showDayPanel && selectedDate && (
        <div className="sm:hidden border-t border-[--border]">
          <div className="px-4 py-3 bg-[--surface-2] border-b border-[--border]">
            <p className="text-xs font-semibold text-[--ink]">{fmtFull(selectedDate)}</p>
            <p className="text-[10px] text-[--muted] mt-0.5">
              {selEvents.length} {selEvents.length === 1 ? 'scadenza' : 'scadenze'}
              {' · '}
              {fmtEur(selEvents.reduce((s, e) => s + e.amountMinor, 0))}
            </p>
          </div>
          <div className="divide-y divide-[--border]">
            {selEvents.map((e, i) => (
              <div key={i} className="px-4 py-3 flex items-start gap-3">
                <span
                  className="size-2 rounded-full shrink-0 mt-1"
                  style={{ background: SOURCE_DOT[e.source] ?? 'var(--muted)' }}
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <Badge variant={SOURCE_BADGE[e.source] ?? 'neutral'}>
                    {SOURCE_LABELS[e.source] ?? e.source}
                  </Badge>
                  <p className="text-xs text-[--ink]">{e.label}</p>
                  <p className="text-xs font-mono tabular-nums text-[--muted]">
                    {fmtEur(e.amountMinor)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
