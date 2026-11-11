import { forwardRef } from 'react'
import { cn } from '@/lib/cn'

/* ─── Field wrapper ─────────────────────────────────────────────────────────── */

interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string
  htmlFor?: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
}

export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className,
  ...props
}: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)} {...props}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-sm font-medium text-(--ink) select-none"
        >
          {label}
          {required && (
            <span className="text-(--danger) ml-0.5" aria-hidden>*</span>
          )}
        </label>
      )}
      {children}
      {error && (
        <p className="text-xs text-(--danger) flex items-center gap-1" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-xs text-(--muted)">{hint}</p>
      )}
    </div>
  )
}

/* ─── Input ─────────────────────────────────────────────────────────────────── */

const inputBase = [
  'w-full rounded-lg border border-(--border) bg-(--surface-2)',
  'text-sm text-(--ink) placeholder:text-(--faint)',
  'px-3 h-9 transition-colors duration-150',
  'focus:outline-none focus:ring-2 focus:ring-(--ring) focus:border-(--brand)',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  'aria-[invalid=true]:border-(--danger) aria-[invalid=true]:ring-(--danger)/30',
].join(' ')

function isPlainCount(p: React.InputHTMLAttributes<HTMLInputElement>): boolean {
  if (p.type !== 'number') return false
  const step = p.step === undefined ? 1 : Number(p.step)
  return Number.isInteger(step) && p.min !== undefined && Number(p.min) >= 0
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, inputMode, ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={error ? true : undefined}
        // Su mobile: tastierino numerico per i numeri interi non negativi
        // (anni, km, cavalli). Importi decimali e valori che possono essere
        // negativi restano sulla tastiera di type="number", che ha segno e virgola.
        inputMode={inputMode ?? (isPlainCount(props) ? 'numeric' : undefined)}
        className={cn(inputBase, className)}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

/* ─── Textarea ──────────────────────────────────────────────────────────────── */

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        aria-invalid={error ? true : undefined}
        className={cn(
          'w-full rounded-lg border border-(--border) bg-(--surface-2)',
          'text-sm text-(--ink) placeholder:text-(--faint)',
          'px-3 py-2 transition-colors duration-150 resize-y min-h-[80px]',
          'focus:outline-none focus:ring-2 focus:ring-(--ring) focus:border-(--brand)',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'aria-[invalid=true]:border-(--danger) aria-[invalid=true]:ring-(--danger)/30',
          className,
        )}
        {...props}
      />
    )
  },
)
Textarea.displayName = 'Textarea'

export { Input, Textarea }
