interface ProgressBarProps {
  /** Valore corrente */
  value: number
  /** Valore massimo (denominatore) */
  max: number
  /** Colore CSS della barra (default: var(--brand)) */
  color?: string
  className?: string
}

/** Barra di avanzamento lineare. `value/max` determina la larghezza percentuale (clamped 0–100). */
export function ProgressBar({ value, max, color, className }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0
  return (
    <div className={`h-2 bg-[--surface-2] rounded-full overflow-hidden ${className ?? ''}`}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color ?? 'var(--brand)' }}
      />
    </div>
  )
}
