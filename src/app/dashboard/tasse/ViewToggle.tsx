'use client'

import { useRouter, useSearchParams } from 'next/navigation'
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
  const advanced = sp.get('vista') === 'avanzata'

  function go(toAdvanced: boolean) {
    const params = new URLSearchParams(sp.toString())
    if (toAdvanced) params.set('vista', 'avanzata')
    else params.delete('vista')
    router.replace(`/dashboard/tasse?${params.toString()}`)
  }

  const options: { label: string; advanced: boolean }[] = [
    { label: 'Essenziale', advanced: false },
    { label: 'Avanzata',   advanced: true  },
  ]

  return (
    <div
      role="tablist"
      aria-label="Livello di dettaglio"
      className="inline-flex items-center gap-0.5 rounded-lg border border-[--border] bg-[--surface-2] p-0.5"
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
              'rounded-md px-3 py-1 text-xs font-medium transition-colors [transition-timing-function:var(--ease-spring)]',
              active
                ? 'bg-[--surface] text-[--ink] shadow-[var(--shadow-sm)]'
                : 'text-[--muted] hover:text-[--ink]',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
