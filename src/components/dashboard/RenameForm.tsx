'use client'
import { useState, useActionState, useEffect, useRef } from 'react'
import { Pencil, X } from 'lucide-react'
import { Button, Field, Input } from '@/components/ui'

type State = { error?: string } | undefined

interface RenameFormProps {
  /** Server action già bound all'id, firma Pattern A (prev, formData) */
  action: (prev: State, formData: FormData) => Promise<State>
  currentName: string
  label?: string
}

/** Rinomina inline riusabile (conto, portafoglio). Toggle → form → salva. */
export default function RenameForm({ action, currentName, label = 'Nome' }: RenameFormProps) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<State, FormData>(action, undefined)
  const wasPending = useRef(false)

  // Chiude il form quando un salvataggio si conclude senza errore.
  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) setOpen(false)
    wasPending.current = pending
  }, [pending, state])

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" />
        Rinomina
      </Button>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <Field label={label} htmlFor="rename-input" className="flex-1">
        <Input id="rename-input" name="name" defaultValue={currentName} required autoFocus maxLength={100} />
      </Field>
      <div className="flex gap-2 shrink-0">
        <Button type="submit" loading={pending}>Salva</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} aria-label="Annulla">
          <X className="size-4" />
        </Button>
      </div>
      {state?.error && <p className="text-xs text-[--danger] self-center">{state.error}</p>}
    </form>
  )
}
