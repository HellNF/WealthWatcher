import { cn } from '@/lib/cn'
import { WatcherMark } from './WatcherMark'

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** Mostra anche il nome del prodotto accanto al logo */
  showName?: boolean
}

const sizeClasses = {
  sm: { mark: 'sm' as const, text: 'text-sm' },
  md: { mark: 'md' as const, text: 'text-base' },
  lg: { mark: 'lg' as const, text: 'text-lg' },
}

export function BrandMark({ size = 'md', showName = false, className }: BrandMarkProps) {
  const classes = sizeClasses[size]
  return (
    <span className={cn('inline-flex items-center gap-2 select-none', className)}>
      <WatcherMark
        size={classes.mark}
        className="text-[--brand]"
      />
      {showName && (
        <span className={cn('font-semibold text-[--ink]', classes.text)}>
          WealthWatcher
        </span>
      )}
    </span>
  )
}
