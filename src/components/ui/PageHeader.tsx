import { cn } from '@/lib/cn'
import { Breadcrumb } from './Breadcrumb'
import type { BreadcrumbItem } from './Breadcrumb'

interface PageHeaderProps {
  title: React.ReactNode
  /** Una riga di contesto sotto il titolo */
  description?: React.ReactNode
  /** Briciole di pane: restano agganciate al titolo invece di fluttuare a distanza di sezione */
  breadcrumb?: BreadcrumbItem[]
  /** Badge o metadati accanto al titolo */
  meta?: React.ReactNode
  /** Controlli a destra (filtri, azioni primarie) */
  actions?: React.ReactNode
  /** id dell'h1, osservabile da StickyBar */
  titleId?: string
  className?: string
}

/** Testata unica di ogni pagina dashboard: breadcrumb, h1, descrizione, azioni. */
export function PageHeader({ title, description, breadcrumb, meta, actions, titleId, className }: PageHeaderProps) {
  return (
    <header className={cn('space-y-3', className)}>
      {breadcrumb && <Breadcrumb items={breadcrumb} />}
      <div className="flex items-end justify-between gap-x-6 gap-y-3 flex-wrap">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 id={titleId} className="text-3xl font-extrabold font-display tracking-[-0.02em] text-(--ink) [text-wrap:balance]">
              {title}
            </h1>
            {meta}
          </div>
          {description && (
            <p className="text-sm text-(--muted) max-w-[65ch] [text-wrap:pretty]">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap min-w-0 max-w-full sm:shrink-0">{actions}</div>}
      </div>
    </header>
  )
}
