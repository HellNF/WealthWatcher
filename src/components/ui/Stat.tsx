import { cn } from '@/lib/cn'
import { Badge } from './Badge'

export type StatSize = 'sm' | 'md' | 'lg'

interface StatProps {
  label: string
  value: React.ReactNode
  /** Delta numerico (es. +1234 o -567). Se fornito, mostra badge gain/loss */
  delta?: number | null
  /** Testo delta formattato (sovrascrive il formato automatico) */
  deltaLabel?: string
  size?: StatSize
  className?: string
  /** Testo secondario sotto il valore */
  sub?: React.ReactNode
}

const sizeClasses = {
  label: { sm: 'text-xs', md: 'text-xs', lg: 'text-sm' },
  value: { sm: 'text-lg',  md: 'text-2xl', lg: 'text-3xl' },
}

export function Stat({
  label,
  value,
  delta,
  deltaLabel,
  size = 'md',
  sub,
  className,
}: StatProps) {
  const hasDelta = delta !== undefined && delta !== null
  const isPositive = hasDelta && delta >= 0
  const formattedDelta = deltaLabel ?? (hasDelta
    ? `${delta >= 0 ? '+' : ''}${delta.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '')

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className={cn('font-medium text-[--muted] uppercase tracking-wide', sizeClasses.label[size])}>
        {label}
      </span>
      <div className="flex items-end gap-2 flex-wrap">
        <span
          className={cn(
            'font-mono tabular-nums font-semibold text-[--ink] leading-none',
            sizeClasses.value[size],
          )}
        >
          {value}
        </span>
        {hasDelta && formattedDelta && (
          <Badge variant={isPositive ? 'gain' : 'loss'} className="mb-0.5">
            {formattedDelta}
          </Badge>
        )}
      </div>
      {sub && (
        <span className="text-xs text-[--muted]">{sub}</span>
      )}
    </div>
  )
}
