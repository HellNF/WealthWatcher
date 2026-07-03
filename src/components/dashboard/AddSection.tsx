'use client'
import { useState } from 'react'
import { Plus, X } from 'lucide-react'

interface Props {
  title: string
  subtitle?: string
  addLabel?: string
  form: React.ReactNode
  children: React.ReactNode
}

export function AddSection({ title, subtitle, addLabel = 'Aggiungi', form, children }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[--ink]">{title}</h2>
          {subtitle && <p className="text-sm text-[--muted]">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-[--border] bg-[--surface-1] px-3 py-1.5 text-sm font-medium text-[--brand-text] hover:bg-[--surface-2] transition-colors"
        >
          {open
            ? <X className="size-4" strokeWidth={1.75} />
            : <Plus className="size-4" strokeWidth={1.75} />}
          {open ? 'Annulla' : addLabel}
        </button>
      </div>
      {open && form}
      {children}
    </section>
  )
}
