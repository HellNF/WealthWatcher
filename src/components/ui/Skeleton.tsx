import { cn } from '@/lib/cn'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Variante visiva della forma */
  variant?: 'text' | 'metric' | 'row' | 'avatar' | 'block'
}

const variantClasses: Record<NonNullable<SkeletonProps['variant']>, string> = {
  text:   'h-4 w-32 rounded',
  metric: 'h-8 w-48 rounded-lg',
  row:    'h-10 w-full rounded-lg',
  avatar: 'size-8 rounded-full',
  block:  'h-32 w-full rounded-2xl',
}

export function Skeleton({ variant = 'text', className, ...props }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Caricamento…"
      className={cn(
        'animate-pulse bg-[--surface-2]',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  )
}

/** Gruppo di skeleton per un'intera sezione */
export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-[--border] bg-[--surface] p-5 space-y-3">
      <Skeleton variant="text" className="w-24" />
      <Skeleton variant="metric" />
      <Skeleton variant="text" className="w-40" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3 px-1">
      <Skeleton variant="avatar" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="w-40" />
        <Skeleton variant="text" className="w-24" />
      </div>
      <Skeleton variant="text" className="w-20" />
    </div>
  )
}
