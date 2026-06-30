'use client'
import { useActionState } from 'react'
import { Plus } from 'lucide-react'
import { addPortfolio, type ActionState } from './actions'
import { Button, Field, Input } from '@/components/ui'

export default function AddPortfolioForm({ institutionId }: { institutionId: number }) {
  const boundAction = addPortfolio.bind(null, institutionId)
  const [state, action, pending] = useActionState<ActionState, FormData>(boundAction, undefined)

  return (
    <form action={action} className="flex flex-col sm:flex-row gap-2 sm:items-end">
      <Field label="Nome portafoglio" htmlFor="pf-name" className="flex-1">
        <Input
          id="pf-name"
          name="name"
          required
          placeholder="es. ETF Accumulo"
        />
      </Field>
      <Field label="Valuta" htmlFor="pf-currency" className="w-28">
        <Input
          id="pf-currency"
          name="currency"
          defaultValue="EUR"
          maxLength={3}
          required
          className="uppercase"
        />
      </Field>
      <Button type="submit" variant="secondary" loading={pending} className="shrink-0 self-end">
        <Plus className="size-4" />
        Portafoglio
      </Button>
      {state?.error && (
        <p className="text-sm text-[--danger] w-full">{state.error}</p>
      )}
    </form>
  )
}
