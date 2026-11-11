'use client'

import { CalendarClock } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import type { DeadlinesWidgetData, WidgetSize } from './types'
import { FitList, plural } from './FitList'
import { fmtEur, fmtIsoDayMonth } from '@/lib/format'

function daysUntil(iso: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${iso}T00:00:00`)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

const SOURCE_DOT: Record<string, string> = {
  bollo:            'var(--muted)',
  ivafe:            'var(--muted)',
  credito_fiscale:  'var(--warning)',
  rata_mutuo:       'var(--info)',
  ricorrente:       'var(--brand)',
  custom:           'var(--brand)',
  dividendo_atteso: 'var(--brand)',
  stipendio_atteso: 'var(--brand)',
  interessi_conto:  'var(--brand)',
  obiettivo:        'var(--info)',
  consenso_banca:   'var(--warning)',
  harvesting:       'var(--warning)',
  franchigia_crypto:'var(--warning)',
}

const SOURCE_LABEL: Record<string, string> = {
  bollo:            'Bollo',
  ivafe:            'IVAFE',
  credito_fiscale:  'Credito fiscale',
  rata_mutuo:       'Mutuo',
  ricorrente:       'Ricorrente',
  custom:           'Personale',
  dividendo_atteso: 'Dividendo',
  stipendio_atteso: 'Stipendio',
  interessi_conto:  'Interessi',
  obiettivo:        'Obiettivo',
  consenso_banca:   'Open Banking',
  harvesting:       'Harvesting',
  franchigia_crypto:'Crypto',
}

// Massimo di righe; quante se ne vedono davvero lo decide FitList
const ITEMS_VISIBLE: Record<WidgetSize, number> = { sm: 8, md: 8, lg: 8 }

export function DeadlinesWidget({ data, size }: { data: DeadlinesWidgetData; size: WidgetSize }) {
  const { upcoming } = data
  const limit = ITEMS_VISIBLE[size]
  const visible = upcoming.slice(0, limit)

  if (upcoming.length === 0) {
    return (
      <EmptyState
        className="flex-1 py-6 sm:py-6"
        icon={CalendarClock}
        title="Nessuna scadenza imminente"
        description="Nessuna scadenza nei prossimi 30 giorni."
      />
    )
  }

  return (
    <FitList
      className="divide-y divide-(--border) -mx-4 sm:-mx-5"
      more={(n) => plural(n + upcoming.length - visible.length, 'altra scadenza', 'altre scadenze')}
    >
      {visible.map((ev, i) => {
        const days   = daysUntil(ev.date)
        const urgent = days <= 3
        const dot    = SOURCE_DOT[ev.source] ?? 'var(--muted)'

        return (
          <div key={i} className="flex items-center gap-3 px-4 sm:px-5 py-3">
            <span className="size-2 rounded-full shrink-0" style={{ background: dot }} />

            <div className="flex-1 min-w-0">
              <p className="text-xs text-(--ink) [overflow-wrap:anywhere] leading-snug">{ev.label}</p>
              <p className="text-[10px] text-(--faint) mt-0.5">
                {SOURCE_LABEL[ev.source] ?? ev.source}
              </p>
            </div>

            <div className="text-right shrink-0">
              {ev.amountMinor > 0 && (
                <p className="text-xs font-mono tabular-nums text-(--ink)">{fmtEur(ev.amountMinor, 0)}</p>
              )}
              <p className={`text-[10px] tabular-nums mt-0.5 ${urgent ? 'text-(--danger) font-semibold' : 'text-(--muted)'}`}>
                {days === 0 ? 'Oggi' : days === 1 ? 'Domani' : `${fmtIsoDayMonth(ev.date)} · ${days}gg`}
              </p>
            </div>
          </div>
        )
      })}
    </FitList>
  )
}
