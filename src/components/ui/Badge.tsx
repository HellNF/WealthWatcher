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
  success: 'bg-[--brand-subtle] text-[--brand-text]',
  danger:  'bg-[--danger-subtle] text-[--danger-text]',
  warning: 'bg-[--warning-subtle] text-[--warning-text]',
  info:    'bg-[--info-subtle] text-[--info-text]',
  neutral: 'bg-[--surface-2] text-[--muted]',
  // P/L semantici — gain = brand, loss = danger
  gain: 'bg-[--brand-subtle] text-[--brand-text]',
  loss: 'bg-[--danger-subtle] text-[--danger-text]',
}

export function Badge({ variant = 'neutral', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-black/[0.03] dark:ring-white/[0.04]',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
