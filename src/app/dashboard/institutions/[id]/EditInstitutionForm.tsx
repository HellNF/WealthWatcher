'use client'
import { useState, useActionState, useEffect, useRef } from 'react'
import { Pencil, X } from 'lucide-react'
import { Button, Field, Input, Select } from '@/components/ui'
import { updateInstitutionAction } from './actions'

type State = { error?: string } | undefined

interface Props {
  institutionId: number
  name: string
  kind: string
}

export default function EditInstitutionForm({ institutionId, name, kind }: Props) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<State, FormData>(
    updateInstitutionAction.bind(null, institutionId),
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
        Modifica
      </Button>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Field label="Nome" htmlFor="inst-edit-name" className="flex-1">
        <Input id="inst-edit-name" name="name" defaultValue={name} required autoFocus maxLength={100} />
      </Field>
      <Field label="Tipo" htmlFor="inst-edit-kind">
        <Select id="inst-edit-kind" name="kind" defaultValue={kind}>
          <option value="bank">Banca</option>
          <option value="broker">Broker</option>
          <option value="both">Banca · Broker</option>
        </Select>
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
