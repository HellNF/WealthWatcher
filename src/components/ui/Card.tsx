import { cn } from '@/lib/cn'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  /** Rimuove padding interno */
  noPadding?: boolean
  /** Solleva leggermente la card al passaggio del mouse (per tile cliccabili) */
  hoverable?: boolean
}

export function Card({ className, children, noPadding, hoverable, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[--border] bg-[--surface]',
        'shadow-[var(--shadow-sm),var(--highlight)]',
        'transition-[transform,box-shadow,border-color] duration-300 [transition-timing-function:var(--ease-spring)]',
        hoverable && 'hover:-translate-y-0.5 hover:shadow-[var(--shadow-md),var(--highlight)] hover:border-[--border]',
        !noPadding && 'p-4 sm:p-5',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn('flex items-center justify-between gap-3 mb-4', className)}
      {...props}
    >
      {children}
    </div>
  )
}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode
  as?: 'h1' | 'h2' | 'h3' | 'h4'
}

export function CardTitle({ className, children, as: Tag = 'h2', ...props }: CardTitleProps) {
  return (
    <Tag
      className={cn('text-base font-semibold text-[--ink] text-wrap-balance', className)}
      {...props}
    >
      {children}
    </Tag>
  )
}

interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode
}

export function CardDescription({ className, children, ...props }: CardDescriptionProps) {
  return (
    <p
      className={cn('text-sm text-[--muted] mt-0.5', className)}
      {...props}
    >
      {children}
    </p>
  )
}
