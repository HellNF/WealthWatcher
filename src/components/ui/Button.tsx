import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children: React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    'bg-[--brand] text-[--brand-fg] border-transparent',
    'shadow-[var(--shadow-sm),inset_0_1px_0_0_oklch(1_0_0/0.25)]',
    'hover:bg-[--brand-hover] hover:-translate-y-px hover:shadow-[var(--shadow-md),inset_0_1px_0_0_oklch(1_0_0/0.25)]',
    'active:scale-[0.98] active:translate-y-0',
    'disabled:opacity-50',
  ].join(' '),
  secondary: [
    'bg-transparent text-[--ink] border-[--border]',
    'hover:bg-[--surface-2] hover:-translate-y-px',
    'active:scale-[0.98] active:translate-y-0',
    'disabled:opacity-50',
  ].join(' '),
  ghost: [
    'bg-transparent text-[--muted] border-transparent',
    'hover:bg-[--surface-2] hover:text-[--ink]',
    'active:scale-[0.98]',
    'disabled:opacity-50',
  ].join(' '),
  danger: [
    'bg-transparent text-[--danger] border-[--danger]/40',
    'hover:bg-[--danger-subtle] hover:border-[--danger]',
    'active:scale-[0.98]',
    'disabled:opacity-50',
  ].join(' '),
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 px-3 text-xs gap-1.5 rounded-md',
  md: 'h-9 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-6 text-base gap-2.5 rounded-xl',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-medium border transition-all duration-200 [transition-timing-function:var(--ease-spring)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--ring]',
          'cursor-pointer disabled:cursor-not-allowed select-none',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="size-3.5 animate-spin shrink-0" />
            {children}
          </>
        ) : children}
      </button>
    )
  },
)
Button.displayName = 'Button'

export { Button }
