import { cn } from '@/lib/cn'

const PIXEL_SIZES = { sm: 20, md: 28, lg: 36 } as const

interface WatcherMarkProps {
  /** Taglia named oppure pixel espliciti */
  size?: keyof typeof PIXEL_SIZES | number
  className?: string
}

/**
 * Glifo SVG "Aperture / Watcher":
 * un anello-lente con una linea di trend in salita all'interno.
 * Usa `currentColor` — impostare il colore con una classe Tailwind
 * (es. `text-[--brand]` o `text-emerald-400`).
 */
export function WatcherMark({ size = 'md', className }: WatcherMarkProps) {
  const px = typeof size === 'number' ? size : PIXEL_SIZES[size]
  // Sotto 22px nascondiamo il punto focale per leggibilità
  const showDot = px >= 22

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      {/* Anello esterno — la lente */}
      <circle cx="12" cy="12" r="8.5" strokeWidth="1.75" />

      {/* Trend in salita (price line) */}
      <polyline
        points="7.5,14.5 10.5,11 13,13.5 16.5,8.5"
        strokeWidth="1.75"
      />

      {/* Tick finale (freccia verso l'alto-destra) */}
      <polyline points="14.5,8.5 16.5,8.5 16.5,10.5" strokeWidth="1.75" />

      {/* Punto focale (visibile solo ≥ 22px) */}
      {showDot && (
        <circle cx="10.5" cy="11" r="1" fill="currentColor" stroke="none" />
      )}
    </svg>
  )
}
