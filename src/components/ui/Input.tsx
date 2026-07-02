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
          className="text-sm font-medium text-[--ink] select-none"
        >
          {label}
          {required && (
            <span className="text-[--danger] ml-0.5" aria-hidden>*</span>
          )}
        </label>
      )}
      {children}
      {error && (
        <p className="text-xs text-[--danger] flex items-center gap-1" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-xs text-[--muted]">{hint}</p>
      )}
    </div>
  )
}

/* ─── Input ─────────────────────────────────────────────────────────────────── */

const inputBase = [
  'w-full rounded-lg border border-[--border] bg-[--surface-2]',
  'text-sm text-[--ink] placeholder:text-[--faint]',
  'px-3 h-9 transition-colors duration-150',
  'focus:outline-none focus:ring-2 focus:ring-[--ring] focus:border-[--brand]',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  'aria-[invalid=true]:border-[--danger] aria-[invalid=true]:ring-[--danger]/30',
].join(' ')

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={error ? true : undefined}
        className={cn(inputBase, className)}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

/* ─── Select ────────────────────────────────────────────────────────────────── */

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        aria-invalid={error ? true : undefined}
        className={cn(
          inputBase,
          'cursor-pointer appearance-none',
          'bg-[image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23888\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")] bg-no-repeat bg-[right_0.75rem_center]',
          'pr-8',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    )
  },
)
Select.displayName = 'Select'

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
          'w-full rounded-lg border border-[--border] bg-[--surface-2]',
          'text-sm text-[--ink] placeholder:text-[--faint]',
          'px-3 py-2 transition-colors duration-150 resize-y min-h-[80px]',
          'focus:outline-none focus:ring-2 focus:ring-[--ring] focus:border-[--brand]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'aria-[invalid=true]:border-[--danger] aria-[invalid=true]:ring-[--danger]/30',
          className,
        )}
        {...props}
      />
    )
  },
)
Textarea.displayName = 'Textarea'

export { Input, Select, Textarea }
