import { cn } from '@/lib/cn'

/** Una riga etichetta/valore dentro una DataCard mobile. */
interface DataRowProps {
  label: string
  children: React.ReactNode
  className?: string
}

export function DataRow({ label, children, className }: DataRowProps) {
  return (
    <div className={cn('flex items-center justify-between gap-2 py-1.5', className)}>
      <span className="text-xs text-[--muted] shrink-0">{label}</span>
      <span className="text-xs text-[--ink] font-medium text-right min-w-0">{children}</span>
    </div>
  )
}

/** Header della DataCard: titolo principale, sottotitolo opzionale, azioni opzionali. */
interface DataCardHeaderProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  badge?: React.ReactNode
  actions?: React.ReactNode
}

export function DataCardHeader({ title, subtitle, badge, actions }: DataCardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-2 mb-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-[--ink] truncate">{title}</span>
          {badge}
        </div>
        {subtitle && (
          <span className="text-xs text-[--muted] mt-0.5 block">{subtitle}</span>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-1 shrink-0">{actions}</div>
      )}
    </div>
  )
}

/** Card singola per rappresentare una riga di tabella su mobile. */
interface DataCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function DataCard({ className, children, ...props }: DataCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[--border] bg-[--surface] px-4 py-3',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
