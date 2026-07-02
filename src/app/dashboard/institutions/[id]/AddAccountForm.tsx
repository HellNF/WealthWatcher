'use client'
import { useActionState } from 'react'
import { Plus } from 'lucide-react'
import { addAccount, type ActionState } from './actions'
import { Button, Field, Input, Select } from '@/components/ui'

export default function AddAccountForm({ institutionId }: { institutionId: number }) {
  const boundAction = addAccount.bind(null, institutionId)
  const [state, action, pending] = useActionState<ActionState, FormData>(boundAction, undefined)

  return (
    <form action={action} className="flex flex-col sm:flex-row gap-2 sm:items-end">
      <Field label="Nome conto" htmlFor="acc-name" className="flex-1">
        <Input
          id="acc-name"
          name="name"
          required
          placeholder="es. Conto corrente"
        />
      </Field>
      <Field label="Valuta" htmlFor="acc-currency">
        <Select id="acc-currency" name="currency" defaultValue="EUR">
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
          <option value="GBP">GBP</option>
          <option value="CHF">CHF</option>
        </Select>
      </Field>
      <Button type="submit" loading={pending} className="shrink-0 self-end">
        <Plus className="size-4" />
        Aggiungi conto
      </Button>
      {state?.error && (
        <p className="text-sm text-[--danger]">{state.error}</p>
      )}
    </form>
  )
}
