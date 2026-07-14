'use client'

import Link from 'next/link'
import { Trash2, ArrowUpRight } from 'lucide-react'
import { Badge } from '@/components/ui'
import type { DeadlineEvent } from '@/lib/calendar'
import { deleteCalendarEventAction } from './actions'
import { metaFor, fmtEur, fmtShort, countdownLabel } from './eventMeta'

const CONFIDENCE_CHIP: Record<DeadlineEvent['confidence'], string | null> = {
  certain: null, estimated: 'stima', inferred: 'stimato',
}

/** Importo formattato + colore in base a direzione/natura dell'evento. */
function amountDisplay(e: DeadlineEvent): { text: string; cls: string } | null {
  if (e.amountMinor <= 0) return null
  if (e.kind === 'cash' && e.direction === 'in') {
    return { text: `+${fmtEur(e.amountMinor)}`, cls: 'text-[--brand-text]' }
  }
  if (e.kind === 'cash' && e.direction === 'out') {
    return { text: `−${fmtEur(e.amountMinor)}`, cls: 'text-[--ink]' }
  }
  // opportunity / info: valore a rischio o residuo, tono neutro
  return { text: fmtEur(e.amountMinor), cls: 'text-[--muted]' }
}

interface Props {
  event:      DeadlineEvent
  today:      string
  showDate?:  boolean   // mostra il giorno (agenda) vs nascondilo (dettaglio giorno)
}

export default function EventRow({ event: e, today, showDate = true }: Props) {
  const meta = metaFor(e.source)
  const Icon = meta.icon
  const amount = amountDisplay(e)
  const chip = CONFIDENCE_CHIP[e.confidence]
  const isInferred = e.confidence === 'inferred'

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span
        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${isInferred ? 'border border-dashed border-[--border]' : ''}`}
        style={{ background: isInferred ? 'transparent' : 'var(--surface-2)' }}
      >
        <Icon className="size-4" strokeWidth={1.75} style={{ color: meta.dot }} aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={meta.badge}>{meta.label}</Badge>
          {chip && (
            <span className="text-[10px] uppercase tracking-wide text-[--faint] border border-dashed border-[--border] rounded px-1 py-px">
              {chip}
            </span>
          )}
          {showDate && (
            <span className="text-[11px] text-[--faint] tabular-nums">
              {fmtShort(e.date)} · {countdownLabel(e.date, today)}
            </span>
          )}
        </div>
        <p className="text-sm text-[--ink] leading-snug mt-1">{e.label}</p>
        {e.suggestion && (
          <p className="text-xs text-[--muted] leading-relaxed mt-1">{e.suggestion}</p>
        )}
        {e.href && (
          <Link
            href={e.href}
            className="inline-flex items-center gap-0.5 text-xs font-medium text-[--brand-text] mt-1 hover:gap-1 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] rounded"
          >
            Approfondisci <ArrowUpRight className="size-3" strokeWidth={2} />
          </Link>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        {amount && (
          <span className={`text-sm font-mono tabular-nums ${amount.cls}`}>{amount.text}</span>
        )}
        {e.source === 'custom' && e.id !== undefined && (
          <form action={deleteCalendarEventAction.bind(null, e.id)}>
            <button
              type="submit"
              className="flex size-6 items-center justify-center rounded text-[--faint] hover:text-[--danger] hover:bg-[--danger-subtle] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
              aria-label="Elimina evento"
              title="Elimina"
            >
              <Trash2 className="size-3.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
