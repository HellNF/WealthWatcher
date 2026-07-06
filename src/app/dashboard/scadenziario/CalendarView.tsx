'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useActionState } from 'react'
import type { DeadlineEvent } from '@/lib/calendar'
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui'
import { fromMinor } from '@/lib/money'
import { addCalendarEventAction, deleteCalendarEventAction, type EventActionState } from './actions'

// ── Design tokens per tipo di evento ──────────────────────────────────────

const SOURCE_DOT: Record<string, string> = {
  bollo:           'var(--muted)',
  ivafe:           'var(--muted)',
  credito_fiscale: 'var(--warning)',
  rata_mutuo:      'var(--info)',
  ricorrente:      'var(--brand)',
  custom:          'var(--brand)',
}

const SOURCE_LABELS: Record<string, string> = {
  bollo:           'Bollo',
  ivafe:           'IVAFE',
  credito_fiscale: 'Credito fiscale',
  rata_mutuo:      'Mutuo',
  ricorrente:      'Ricorrente',
  custom:          'Personale',
}

const SOURCE_BADGE: Record<string, 'warning' | 'info' | 'neutral' | 'success'> = {
  bollo:           'neutral',
  ivafe:           'neutral',
  credito_fiscale: 'warning',
  rata_mutuo:      'info',
  ricorrente:      'neutral',
  custom:          'success',
}

const LEGEND: { source: string; label: string }[] = [
  { source: 'ricorrente',      label: 'Ricorrente' },
  { source: 'rata_mutuo',      label: 'Mutuo' },
  { source: 'credito_fiscale', label: 'Credito fiscale' },
  { source: 'bollo',           label: 'Bollo / IVAFE' },
  { source: 'custom',          label: 'Personale' },
]

// Suggerimenti per eventi personalizzati
const LABEL_SUGGESTIONS = [
  'Saldo IRPEF', 'I Acconto IRPEF', 'II Acconto IRPEF',
  'Saldo IVA', 'Acconto IVA', 'IMU', 'TARI',
  'F24', 'Bollo auto', 'Assicurazione auto',
  'Canone affitto', 'Abbonamento annuale', 'Scadenza mutuo',
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
  const [showAddForm, setShowAddForm]   = useState(false)

  const [addState, addAction, isAdding] = useActionState<EventActionState, FormData>(
    addCalendarEventAction, undefined,
  )
  const didSubmitRef = useRef(false)

  // Chiude il form dopo un'aggiunta andata a buon fine
  useEffect(() => {
    if (isAdding) {
      didSubmitRef.current = true
    } else if (didSubmitRef.current && addState === undefined) {
      setShowAddForm(false)
      didSubmitRef.current = false
    }
  }, [isAdding, addState])

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

  // Data da pre-compilare nel form: giorno selezionato (se nel mese corrente) o primo del mese
  const formDate = selectedDate?.startsWith(currentMonth)
    ? selectedDate
    : `${currentMonth}-01`

  function goMonth(delta: number) {
    setCurrentMonth(stepMonth(cy, cm, delta))
  }

  function handleDayClick(date: string) {
    const m = date.slice(0, 7)
    if (m !== currentMonth) setCurrentMonth(m)
    setSelectedDate(prev => prev === date ? null : date)
    setShowAddForm(false)
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
                      inMonth ? 'hover:bg-[--surface-2] cursor-pointer' : 'cursor-default',
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
        {showAddForm ? (
          /* ── Form aggiunta evento ──────────────────────────────────── */
          <>
            <div className="px-4 py-3.5 border-b border-[--border] bg-[--surface-2] flex items-center justify-between">
              <p className="text-xs font-semibold text-[--ink]">Nuovo evento</p>
              <button
                onClick={() => setShowAddForm(false)}
                className="size-5 flex items-center justify-center rounded text-[--muted] hover:text-[--ink] hover:bg-[--surface-3] transition-colors"
                aria-label="Annulla"
              >
                <X className="size-3" />
              </button>
            </div>
            <form action={addAction} className="flex-1 flex flex-col gap-0 overflow-y-auto">
              <input type="hidden" name="date" value={formDate} />
              <div className="px-4 pt-4 pb-3 space-y-3">
                <div>
                  <label className="block text-[10px] font-medium text-[--muted] mb-1">Data</label>
                  <p className="text-xs text-[--ink] font-medium">{fmtFull(formDate)}</p>
                </div>
                <div>
                  <label htmlFor="ev-label" className="block text-[10px] font-medium text-[--muted] mb-1">
                    Descrizione <span className="text-[--danger]">*</span>
                  </label>
                  <input
                    id="ev-label"
                    name="label"
                    list="ev-label-suggestions"
                    required
                    autoComplete="off"
                    placeholder="es. Saldo IRPEF"
                    className="w-full text-xs rounded-lg border border-[--border] bg-[--surface] px-2.5 py-1.5 text-[--ink] placeholder:text-[--faint] focus:outline-none focus:ring-2 focus:ring-[--ring]"
                  />
                  <datalist id="ev-label-suggestions">
                    {LABEL_SUGGESTIONS.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div>
                  <label htmlFor="ev-amount" className="block text-[10px] font-medium text-[--muted] mb-1">
                    Importo € <span className="text-[--faint]">(facoltativo)</span>
                  </label>
                  <input
                    id="ev-amount"
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    className="w-full text-xs rounded-lg border border-[--border] bg-[--surface] px-2.5 py-1.5 text-[--ink] placeholder:text-[--faint] focus:outline-none focus:ring-2 focus:ring-[--ring]"
                  />
                </div>
                <div>
                  <label htmlFor="ev-note" className="block text-[10px] font-medium text-[--muted] mb-1">
                    Note <span className="text-[--faint]">(facoltativo)</span>
                  </label>
                  <textarea
                    id="ev-note"
                    name="note"
                    rows={2}
                    placeholder="Informazioni aggiuntive…"
                    className="w-full text-xs rounded-lg border border-[--border] bg-[--surface] px-2.5 py-1.5 text-[--ink] placeholder:text-[--faint] focus:outline-none focus:ring-2 focus:ring-[--ring] resize-none"
                  />
                </div>
                {addState?.error && (
                  <p className="text-xs text-[--danger]">{addState.error}</p>
                )}
              </div>
              <div className="px-4 pb-4 mt-auto">
                <button
                  type="submit"
                  disabled={isAdding}
                  className="w-full py-1.5 text-xs font-semibold rounded-lg bg-[--brand] text-white hover:opacity-90 disabled:opacity-50 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
                >
                  {isAdding ? 'Salvataggio…' : 'Aggiungi evento'}
                </button>
              </div>
            </form>
          </>
        ) : showDayPanel && selectedDate ? (
          /* ── Dettaglio giorno ──────────────────────────────────────── */
          <>
            <div className="px-4 py-3.5 border-b border-[--border] bg-[--surface-2] flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-[--ink]">{fmtFull(selectedDate)}</p>
                <p className="text-[10px] text-[--muted] mt-0.5">
                  {selEvents.length} {selEvents.length === 1 ? 'scadenza' : 'scadenze'}
                  {' · '}
                  {fmtEur(selEvents.reduce((s, e) => s + e.amountMinor, 0))}
                </p>
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                className="size-6 shrink-0 flex items-center justify-center rounded-lg text-[--muted] hover:text-[--ink] hover:bg-[--surface-3] transition-colors"
                aria-label="Aggiungi evento"
                title="Aggiungi evento"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-[--border]">
              {selEvents.map((e, i) => (
                <div key={i} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ background: SOURCE_DOT[e.source] ?? 'var(--muted)' }}
                      />
                      <Badge variant={SOURCE_BADGE[e.source] ?? 'neutral'}>
                        {SOURCE_LABELS[e.source] ?? e.source}
                      </Badge>
                    </div>
                    {e.source === 'custom' && e.id !== undefined && (
                      <form action={deleteCalendarEventAction.bind(null, e.id)}>
                        <button
                          type="submit"
                          className="size-5 flex items-center justify-center rounded text-[--faint] hover:text-[--danger] hover:bg-[--danger]/10 transition-colors shrink-0"
                          aria-label="Elimina evento"
                          title="Elimina"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </form>
                    )}
                  </div>
                  <p className="text-xs text-[--ink] leading-snug">{e.label}</p>
                  {e.amountMinor > 0 && (
                    <p className="text-xs font-mono tabular-nums text-[--muted]">
                      {fmtEur(e.amountMinor)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          /* ── Riepilogo mese ────────────────────────────────────────── */
          <>
            <div className="px-4 py-3.5 border-b border-[--border] bg-[--surface-2] flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-[--ink]">{MONTHS_IT[cm - 1]} {cy}</p>
                <p className="text-[10px] text-[--muted] mt-0.5">
                  {monthEvents.length === 0
                    ? 'Nessuna scadenza'
                    : `${monthEvents.length} ${monthEvents.length === 1 ? 'scadenza' : 'scadenze'} · ${fmtEur(monthTotal)}`
                  }
                </p>
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                className="size-6 shrink-0 flex items-center justify-center rounded-lg text-[--muted] hover:text-[--ink] hover:bg-[--surface-3] transition-colors"
                aria-label="Aggiungi evento"
                title="Aggiungi evento"
              >
                <Plus className="size-3.5" />
              </button>
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
              <div className="flex-1 flex flex-col items-center justify-center px-5 gap-3">
                <p className="text-xs text-[--faint] text-center leading-relaxed">
                  Seleziona un giorno o aggiungi un evento manuale
                </p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-dashed border-[--border] text-[--muted] hover:text-[--ink] hover:border-[--brand] hover:bg-[--brand-subtle] transition-colors"
                >
                  <Plus className="size-3" />
                  Aggiungi evento
                </button>
              </div>
            )}
          </>
        )}
      </aside>

      {/* ── Dettaglio giorno — mobile (sotto il calendario) ─────────────── */}
      {showDayPanel && selectedDate && !showAddForm && (
        <div className="sm:hidden border-t border-[--border]">
          <div className="px-4 py-3 bg-[--surface-2] border-b border-[--border] flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[--ink]">{fmtFull(selectedDate)}</p>
              <p className="text-[10px] text-[--muted] mt-0.5">
                {selEvents.length} {selEvents.length === 1 ? 'scadenza' : 'scadenze'}
                {' · '}
                {fmtEur(selEvents.reduce((s, e) => s + e.amountMinor, 0))}
              </p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="size-6 shrink-0 flex items-center justify-center rounded-lg text-[--muted] hover:text-[--ink] hover:bg-[--surface-3] transition-colors"
              aria-label="Aggiungi evento"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <div className="divide-y divide-[--border]">
            {selEvents.map((e, i) => (
              <div key={i} className="px-4 py-3 flex items-start gap-3">
                <span
                  className="size-2 rounded-full shrink-0 mt-1"
                  style={{ background: SOURCE_DOT[e.source] ?? 'var(--muted)' }}
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={SOURCE_BADGE[e.source] ?? 'neutral'}>
                      {SOURCE_LABELS[e.source] ?? e.source}
                    </Badge>
                    {e.source === 'custom' && e.id !== undefined && (
                      <form action={deleteCalendarEventAction.bind(null, e.id)}>
                        <button
                          type="submit"
                          className="size-5 flex items-center justify-center rounded text-[--faint] hover:text-[--danger] transition-colors"
                          aria-label="Elimina evento"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </form>
                    )}
                  </div>
                  <p className="text-xs text-[--ink]">{e.label}</p>
                  {e.amountMinor > 0 && (
                    <p className="text-xs font-mono tabular-nums text-[--muted]">
                      {fmtEur(e.amountMinor)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form aggiunta — mobile */}
      {showAddForm && (
        <div className="sm:hidden border-t border-[--border]">
          <div className="px-4 py-3 bg-[--surface-2] border-b border-[--border] flex items-center justify-between">
            <p className="text-xs font-semibold text-[--ink]">Nuovo evento — {fmtFull(formDate)}</p>
            <button onClick={() => setShowAddForm(false)} aria-label="Annulla">
              <X className="size-4 text-[--muted]" />
            </button>
          </div>
          <form action={addAction} className="px-4 py-4 space-y-3">
            <input type="hidden" name="date" value={formDate} />
            <div>
              <label htmlFor="ev-label-m" className="block text-[10px] font-medium text-[--muted] mb-1">
                Descrizione <span className="text-[--danger]">*</span>
              </label>
              <input
                id="ev-label-m"
                name="label"
                list="ev-label-suggestions-m"
                required
                autoComplete="off"
                placeholder="es. Saldo IRPEF"
                className="w-full text-xs rounded-lg border border-[--border] bg-[--surface] px-2.5 py-1.5 text-[--ink] placeholder:text-[--faint] focus:outline-none focus:ring-2 focus:ring-[--ring]"
              />
              <datalist id="ev-label-suggestions-m">
                {LABEL_SUGGESTIONS.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div>
              <label htmlFor="ev-amount-m" className="block text-[10px] font-medium text-[--muted] mb-1">
                Importo € <span className="text-[--faint]">(facoltativo)</span>
              </label>
              <input
                id="ev-amount-m"
                name="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                className="w-full text-xs rounded-lg border border-[--border] bg-[--surface] px-2.5 py-1.5 text-[--ink] placeholder:text-[--faint] focus:outline-none focus:ring-2 focus:ring-[--ring]"
              />
            </div>
            {addState?.error && (
              <p className="text-xs text-[--danger]">{addState.error}</p>
            )}
            <button
              type="submit"
              disabled={isAdding}
              className="w-full py-1.5 text-xs font-semibold rounded-lg bg-[--brand] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isAdding ? 'Salvataggio…' : 'Aggiungi evento'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
