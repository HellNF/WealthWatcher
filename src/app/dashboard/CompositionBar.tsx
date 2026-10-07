'use client'
// src/app/dashboard/CompositionBar.tsx — Quanto pesa ogni blocco sul patrimonio.
// Barra e legenda sono collegate: indicando una voce le altre si attenuano.
import { useState } from 'react'
import { cn } from '@/lib/cn'

export interface CompositionPart {
  label: string
  /** Importo già formattato */
  value: string
  pct: number
  /** Classe di sfondo del segmento (token semantico) */
  bar: string
}

export default function CompositionBar({ parts, stacked, className }: {
  parts: CompositionPart[]
  /** Legenda a righe (colonna stretta) invece che affiancata */
  stacked?: boolean
  className?: string
}) {
  const [active, setActive] = useState<string | null>(null)
  if (parts.length === 0) return null

  const dim = (label: string) => active !== null && active !== label

  return (
    <div className={cn(stacked ? 'space-y-4' : 'w-full sm:w-auto sm:min-w-80 space-y-3', className)} onPointerLeave={() => setActive(null)}>
      <div className="flex h-2 gap-0.5" aria-hidden>
        {parts.map((p) => (
          <span
            key={p.label}
            onPointerEnter={() => setActive(p.label)}
            className={cn(
              'h-full rounded-full transition-opacity duration-150 ease-out',
              p.bar,
              dim(p.label) && 'opacity-25',
            )}
            style={{ width: `${Math.max(p.pct, 1.5)}%` }}
          />
        ))}
      </div>
      <dl className={stacked ? 'space-y-2.5' : 'flex gap-x-8 gap-y-3 flex-wrap'}>
        {parts.map((p) => (
          <div
            key={p.label}
            onPointerEnter={() => setActive(p.label)}
            className={cn(
              'transition-opacity duration-150 ease-out',
              stacked ? 'flex items-baseline justify-between gap-3' : 'space-y-1',
              dim(p.label) && 'opacity-45',
            )}
          >
            <dt className={cn('flex items-center gap-2 text-(--muted)', stacked ? 'text-sm' : 'text-xs gap-1.5')}>
              <span className={cn('size-2 rounded-full', p.bar)} aria-hidden />
              {p.label}
            </dt>
            <dd className={cn('font-mono tabular-nums font-medium text-(--ink) leading-none', stacked ? 'text-sm' : 'text-base')}>
              {p.value}
              <span className="ml-2 inline-block min-w-8 text-right text-xs font-normal font-sans text-(--muted)">{Math.round(p.pct)}%</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
