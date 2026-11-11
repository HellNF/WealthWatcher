import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Navigazione breadcrumb"
      className={cn('flex items-center gap-1 flex-wrap', className)}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1 min-w-0 max-w-full">
            {i > 0 && (
              <ChevronRight
                className="size-3.5 text-(--faint) shrink-0"
                aria-hidden
              />
            )}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                title={item.label}
                className="text-sm text-(--muted) hover:text-(--ink) transition-colors duration-100 truncate max-w-[22ch] sm:max-w-[36ch]"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  'text-sm',
                  isLast ? 'text-(--ink) font-medium [overflow-wrap:anywhere]' : 'text-(--muted) truncate max-w-[22ch] sm:max-w-[36ch]',
                )}
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
