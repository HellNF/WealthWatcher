'use client'
// Controllo segmentato (radiogroup) con pillola che scivola sotto la voce scelta.
// La pillola è in CSS (useSlidingPill), non Motion: resta fluida anche mentre
// il thread principale è occupato e non porta ~40 KB di libreria nel bundle.
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useSlidingPill } from './useSlidingPill'
import { cn } from '@/lib/cn'

export interface SegmentedOption<V extends string> {
  value:     V
  label:     ReactNode
  icon?:     LucideIcon
  disabled?: boolean
  /** Etichetta accessibile quando `label` non è testo (solo icona). */
  ariaLabel?: string
}

interface Props<V extends string> {
  options:   SegmentedOption<V>[]
  value:     V
  onChange:  (value: V) => void
  label:     string
  size?:     'sm' | 'md'
  className?: string
}

const SIZE = {
  sm: 'h-7 pointer-coarse:h-9 min-w-9 px-2.5 text-xs gap-1.5',
  md: 'h-8 px-3 text-sm gap-1.5',
}

export function Segmented<V extends string>({ options, value, onChange, label, size = 'md', className }: Props<V>) {
  const { containerRef, pillRef } = useSlidingPill<HTMLDivElement>(value)

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={label}
      className={cn('relative inline-flex items-center gap-0.5 rounded-lg bg-(--surface-2) p-0.5', className)}
    >
      <span ref={pillRef} aria-hidden className="pointer-events-none absolute left-0 top-0 origin-top-left rounded-md bg-(--surface) shadow-(--shadow-sm) ring-1 ring-(--border) opacity-0" />
      {options.map(({ value: v, label: text, icon: Icon, disabled, ariaLabel }) => {
        const selected = v === value
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={ariaLabel}
            data-pill-key={v}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={cn(
              'relative inline-flex items-center justify-center rounded-md font-medium cursor-pointer select-none',
              'transition-[color,transform,scale,translate] duration-150 ease-out-strong active:scale-[0.97]',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--ring)',
              'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
              SIZE[size],
              selected ? 'text-(--ink)' : 'text-(--muted) hover:text-(--ink)',
            )}
          >
            {Icon && <Icon className={cn('relative shrink-0', size === 'sm' ? 'size-3.5' : 'size-4')} strokeWidth={1.75} />}
            {text != null && <span className="relative">{text}</span>}
          </button>
        )
      })}
    </div>
  )
}
