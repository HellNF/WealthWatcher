import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

// Varianti tipizzate con cva: la stessa ricetta serve anche a chi deve dare
// l'aspetto di un bottone a un altro elemento (es. il trigger di un dialogo,
// un <Link>) tramite `buttonVariants({ variant, size })`.
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center font-medium border',
    'transition-[scale,background-color,border-color,color,box-shadow,opacity,filter] duration-150 ease-out-strong',
    // Risposta alla pressione, subito (Apple: feedback sul pointer-down)
    'active:scale-[0.97] disabled:active:scale-100 data-disabled:active:scale-100',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)',
    'cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 select-none',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-(--brand) text-(--brand-fg) border-transparent',
          'shadow-[var(--shadow-sm),inset_0_1px_0_0_oklch(1_0_0/0.25)]',
          'hover:bg-(--brand-hover)',
        ],
        secondary: 'bg-transparent text-(--ink) border-(--border) hover:bg-(--surface-2)',
        ghost:     'bg-transparent text-(--muted) border-transparent hover:bg-(--surface-2) hover:text-(--ink)',
        danger:    'bg-transparent text-(--danger) border-(--danger)/40 hover:bg-(--danger-subtle) hover:border-(--danger)',
        // Azione distruttiva confermata: piena, solo dentro un dialogo di conferma
        destructive: 'bg-(--danger) text-white border-transparent hover:brightness-95',
      },
      size: {
        sm: 'h-7 px-3 text-xs gap-1.5 rounded-md',
        md: 'h-9 px-4 text-sm gap-2 rounded-lg',
        lg: 'h-11 px-6 text-base gap-2.5 rounded-xl',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

type ButtonVariantProps = VariantProps<typeof buttonVariants>
export type ButtonVariant = NonNullable<ButtonVariantProps['variant']>
export type ButtonSize = NonNullable<ButtonVariantProps['size']>

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariantProps {
  loading?: boolean
  children: React.ReactNode
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, loading, disabled, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(buttonVariants({ variant, size }), className)}
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
