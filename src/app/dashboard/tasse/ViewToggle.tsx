'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { motion, LayoutGroup, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/cn'

/**
 * Segmented control Essenziale | Avanzata. Aggiorna il query param ?vista= via
 * router.replace (no nuova voce history), preservando gli altri parametri (year,
 * quarterly). Il Server Component rilegge searchParams e cambia profondità.
 * Default: Essenziale (nessun parametro).
 */
export default function ViewToggle() {
  const router = useRouter()
  const sp     = useSearchParams()
  const reduceMotion = useReducedMotion()
  const advanced = sp.get('vista') === 'avanzata'

  function go(toAdvanced: boolean) {
    const params = new URLSearchParams(sp.toString())
    if (toAdvanced) params.set('vista', 'avanzata')
    else params.delete('vista')
    router.replace(`/dashboard/tasse?${params.toString()}`, { scroll: false })
  }

  const options: { label: string; advanced: boolean }[] = [
    { label: 'Essenziale', advanced: false },
    { label: 'Avanzata',   advanced: true  },
  ]

  return (
    <LayoutGroup id="tax-view">
      <div
        role="tablist"
        aria-label="Livello di dettaglio"
        className="inline-flex items-center gap-0.5 rounded-lg bg-(--surface-2) p-0.5"
      >
        {options.map((o) => {
          const active = o.advanced === advanced
          return (
            <button
              key={o.label}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => go(o.advanced)}
              className={cn(
                'relative h-8 rounded-md px-3 text-sm font-medium cursor-pointer select-none',
                'transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97]',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--ring)',
                active ? 'text-(--ink)' : 'text-(--muted) hover:text-(--ink)',
              )}
            >
              {active && (
                <motion.span
                  layoutId="tax-view-pill"
                  className="absolute inset-0 rounded-md bg-(--surface) shadow-(--shadow-sm) ring-1 ring-(--border)"
                  transition={reduceMotion ? { duration: 0 } : { type: 'spring', duration: 0.3, bounce: 0 }}
                />
              )}
              <span className="relative">{o.label}</span>
            </button>
          )
        })}
      </div>
    </LayoutGroup>
  )
}
