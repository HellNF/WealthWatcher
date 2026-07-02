'use client'
import { useState, useActionState, useEffect, useRef } from 'react'
import { Pencil, X, Percent } from 'lucide-react'
import { Button, Field, Input } from '@/components/ui'
import { setInterestAction } from './manage-actions'

type State = { error?: string; success?: string } | undefined

interface Props {
  accountId: number
  /** Tasso corrente in percentuale (es. "2.5") o null */
  currentRate: string | null
}

export default function InterestForm({ accountId, currentRate }: Props) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<State, FormData>(
    setInterestAction.bind(null, accountId),
    undefined,
  )
  const wasPending = useRef(false)

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) setOpen(false)
    wasPending.current = pending
  }, [pending, state])

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" />
        {currentRate ? 'Modifica tasso' : 'Imposta tasso'}
      </Button>
    )
  }

  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label="Tasso annuo lordo (%)" htmlFor="int-rate" className="max-w-48">
          <div className="relative">
            <Input
              id="int-rate"
              name="rate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              defaultValue={currentRate ?? ''}
              placeholder="es. 2.5"
              autoFocus
              className="pr-8"
            />
            <Percent className="size-3.5 text-[--faint] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </Field>
        <div className="flex gap-2 shrink-0">
          <Button type="submit" loading={pending}>Salva</Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} aria-label="Annulla">
            <X className="size-4" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-[--muted]">
        Lascia vuoto e salva per rimuovere il tasso. L&apos;interesse mostrato è una stima sulla
        giacenza attuale, al lordo e al netto della ritenuta del 26%.
      </p>
      {state?.error && <p className="text-xs text-[--danger]">{state.error}</p>}
    </form>
  )
}
