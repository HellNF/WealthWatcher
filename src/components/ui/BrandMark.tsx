import { cn } from '@/lib/cn'

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** Mostra anche il nome del prodotto accanto al logo */
  showName?: boolean
}

const sizeClasses = {
  sm: { tile: 'size-6 rounded-md text-xs', text: 'text-sm' },
  md: { tile: 'size-8 rounded-lg text-sm',  text: 'text-base' },
  lg: { tile: 'size-10 rounded-xl text-base', text: 'text-lg' },
}

export function BrandMark({ size = 'md', showName = false, className }: BrandMarkProps) {
  const classes = sizeClasses[size]
  return (
    <span className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      <span
        className={cn(
          'flex items-center justify-center shrink-0',
          'bg-[--brand] text-[--brand-fg] font-bold',
          classes.tile,
        )}
        aria-hidden
      >
        W
      </span>
      {showName && (
        <span className={cn('font-semibold text-[--ink]', classes.text)}>
          WealthWatcher
        </span>
      )}
    </span>
  )
}
