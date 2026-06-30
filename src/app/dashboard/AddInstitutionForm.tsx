'use client'
import { useActionState } from 'react'
import { Plus } from 'lucide-react'
import { addInstitution, type ActionState } from './actions'
import { Button, Field, Input, Select } from '@/components/ui'

export default function AddInstitutionForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addInstitution,
    undefined,
  )

  return (
    <form action={action} className="flex flex-col sm:flex-row gap-2 sm:items-end">
      <Field label="Nome istituzione" htmlFor="inst-name" className="flex-1">
        <Input
          id="inst-name"
          name="name"
          required
          placeholder="es. Intesa Sanpaolo"
        />
      </Field>
      <Field label="Tipo" htmlFor="inst-kind">
        <Select id="inst-kind" name="kind" defaultValue="bank">
          <option value="bank">Banca</option>
          <option value="broker">Broker</option>
          <option value="both">Entrambi</option>
        </Select>
      </Field>
      <Button type="submit" loading={pending} className="shrink-0 self-end">
        <Plus className="size-4" />
        Aggiungi
      </Button>
      {state?.error && (
        <p className="text-sm text-[--danger] sm:col-span-full">{state.error}</p>
      )}
    </form>
  )
}
