'use client'

import { useActionState } from 'react'
import { saveFiscalProfileAction } from './actions'
import { Button, Field, Select } from '@/components/ui'

interface Props {
  currentRate: number | null
}

export default function FiscalProfileForm({ currentRate }: Props) {
  const [state, action, pending] = useActionState(saveFiscalProfileAction, undefined)

  const defaultValue = currentRate != null ? String(currentRate) : ''

  return (
    <form action={action} className="space-y-4">
      <Field
        label="Aliquota marginale IRPEF"
        hint="Usata per stimare il risparmio fiscale sui contributi ai fondi pensione. Controlla il tuo ultimo CU o la dichiarazione dei redditi."
      >
        <Select name="irpef_marginal_rate" defaultValue={defaultValue}>
          <option value="">— Non impostata —</option>
          <option value="0.23">23% (reddito fino a €28.000)</option>
          <option value="0.35">35% (reddito €28.001–€50.000)</option>
          <option value="0.43">43% (reddito oltre €50.000)</option>
        </Select>
      </Field>

      {state?.error && (
        <p className="text-sm text-[--danger]">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-sm text-[--brand-text]">{state.success}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Salvataggio…' : 'Salva'}
      </Button>
    </form>
  )
}
