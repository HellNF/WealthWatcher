import { cn } from '@/lib/cn'

export type BadgeVariant =
  | 'success'
  | 'danger'
  | 'warning'
  | 'info'
  | 'neutral'
  | 'gain'
  | 'loss'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  children: React.ReactNode
}

const variantClasses: Record<BadgeVariant, string> = {
  // gain/success = verde (finanza positiva) — distinto dal brand teal
  success: 'bg-[--gain-subtle] text-[--gain-text]',
  gain:    'bg-[--gain-subtle] text-[--gain-text]',
  // loss/danger = rosso
  danger:  'bg-[--danger-subtle] text-[--danger-text]',
  loss:    'bg-[--danger-subtle] text-[--danger-text]',
  warning: 'bg-[--warning-subtle] text-[--warning-text]',
  info:    'bg-[--info-subtle] text-[--info-text]',
  neutral: 'bg-[--surface-2] text-[--muted]',
}

export function Badge({ variant = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
