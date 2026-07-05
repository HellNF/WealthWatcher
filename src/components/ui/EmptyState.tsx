import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-12 px-6 sm:py-16 sm:px-8 text-center',
        className,
      )}
    >
      {Icon && (
        <div className="rounded-2xl bg-[--surface-2] p-4">
          <Icon className="size-8 text-[--faint]" strokeWidth={1.5} />
        </div>
      )}
      <div className="flex flex-col gap-1.5 max-w-[45ch]">
        <p className="text-sm font-medium text-[--ink]">{title}</p>
        {description && (
          <p className="text-sm text-[--muted] text-wrap-pretty">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
