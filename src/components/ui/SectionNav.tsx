'use client'
// Navigazione tra le sezioni di una pagina lunga: ancore con evidenziazione
// della sezione che si sta leggendo. Risponde a "dove sono? dove posso andare?"
// senza costringere a scorrere per scoprire cosa c'è.
import { useEffect, useState } from 'react'
import { useSlidingPill } from './useSlidingPill'
import { cn } from '@/lib/cn'

export interface SectionLink { id: string; label: string }

interface Props {
  sections: SectionLink[]
  className?: string
}

export function SectionNav({ sections, className }: Props) {
  const [active, setActive] = useState<string | null>(null)
  const { containerRef, pillRef } = useSlidingPill<HTMLElement>(active)

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null)
    if (els.length === 0) return

    // Attiva = l'ultima sezione il cui inizio ha superato il terzo alto dello schermo
    const update = () => {
      const line = window.innerHeight * 0.33
      let current: string | null = null
      for (const el of els) {
        if (el.getBoundingClientRect().top <= line) current = el.id
      }
      setActive(current)
    }
    update()

    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [sections])

  return (
    <nav
      ref={containerRef}
      aria-label="Sezioni della pagina"
      className={cn('relative flex items-center gap-0.5 rounded-lg bg-(--surface-2) p-0.5 max-w-full overflow-x-auto', className)}
    >
      <span ref={pillRef} aria-hidden className="pointer-events-none absolute left-0 top-0 origin-top-left rounded-md bg-(--surface) shadow-(--shadow-sm) ring-1 ring-(--border) opacity-0" />
      {sections.map((s) => {
        const selected = s.id === active
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            data-pill-key={s.id}
            aria-current={selected ? 'location' : undefined}
            className={cn(
              'relative h-7 pointer-coarse:h-9 px-3 flex items-center rounded-md text-xs font-medium whitespace-nowrap select-none',
              'transition-[color,transform,scale,translate] duration-150 ease-out-strong active:scale-[0.97]',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--ring)',
              selected ? 'text-(--ink)' : 'text-(--muted) hover:text-(--ink)',
            )}
          >
            <span className="relative">{s.label}</span>
          </a>
        )
      })}
    </nav>
  )
}
