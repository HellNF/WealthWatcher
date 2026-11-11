import { cn } from '@/lib/cn'

interface ProgressBarProps {
  /** Valore corrente */
  value: number
  /** Valore massimo (denominatore) */
  max: number
  /** Colore CSS della barra (default: var(--brand)) */
  color?: string
  className?: string
}

/**
 * Barra di avanzamento lineare. `value/max` (clamped 0–100) decide quanto la
 * barra sporge dalla traccia: la barra è sempre larga il 100% e scorre con
 * `translateX`, così il cambio di valore anima solo `transform` (composto dal
 * browser, niente ricalcolo del layout come con `width`) e l'estremità resta
 * arrotondata. Al primo render è già al suo posto: si muove solo quando il
 * valore cambia.
 */
export function ProgressBar({ value, max, color, className }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn('h-2 bg-(--surface-2) rounded-full overflow-hidden', className)}
    >
      <div
        className="h-full w-full rounded-full transition-transform duration-300 ease-out-strong motion-reduce:transition-none"
        style={{ transform: `translateX(${pct - 100}%)`, background: color ?? 'var(--brand)' }}
      />
    </div>
  )
}
