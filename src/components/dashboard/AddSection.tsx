'use client'
import { useState } from 'react'
import { Plus } from 'lucide-react'

interface Props {
  title: string
  subtitle?: string
  addLabel?: string
  /** JSX già renderizzato (non un riferimento a componente — attraversa il confine Server/Client) */
  icon?: React.ReactNode
  form: React.ReactNode
  children: React.ReactNode
}

export function AddSection({ title, subtitle, addLabel = 'Aggiungi', icon, form, children }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-[--ink]">
            {icon}
            {title}
          </h2>
          {subtitle && <p className="text-sm text-[--muted]">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-[--border] bg-[--surface-1] px-3 py-1.5 text-sm font-medium text-[--brand-text] hover:bg-[--surface-2] hover:-translate-y-px active:scale-[0.98] active:translate-y-0 transition-all duration-200 [transition-timing-function:var(--ease-spring)]"
        >
          <Plus
            className="size-4 transition-transform duration-300 [transition-timing-function:var(--ease-spring)]"
            style={{ transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}
            strokeWidth={1.75}
          />
          {open ? 'Annulla' : addLabel}
        </button>
      </div>
      {open && form}
      {children}
    </section>
  )
}
