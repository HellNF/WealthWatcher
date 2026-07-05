'use client'

import { useActionState } from 'react'
import { createMortgageAction } from './actions'
import { Button, Field, Input, Select } from '@/components/ui'
import type { BankAccount } from '@/db/schema'

interface Props {
  accounts: BankAccount[]
}

export default function MortgageForm({ accounts }: Props) {
  const [state, action, pending] = useActionState(createMortgageAction, undefined)

  return (
    <form action={action} className="space-y-4">
      <Field label="Nome">
        <Input name="name" placeholder="Es. Mutuo prima casa" required />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Capitale erogato (€)" hint="Importo totale del mutuo">
          <Input name="initial_capital" placeholder="200000" required />
        </Field>
        <Field label="Tasso annuo (decimale)" hint="Es. 0.035 per 3,5%">
          <Input name="annual_interest_rate" placeholder="0.035" required />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Durata (mesi)">
          <Input name="duration_months" type="number" min="1" max="600" placeholder="360" required />
        </Field>
        <Field label="Data prima rata">
          <Input name="start_date" type="date" required />
        </Field>
      </div>

      {accounts.length > 0 && (
        <Field label="Conto associato" hint="Opzionale — per la riconciliazione delle rate">
          <Select name="associated_account_id">
            <option value="">— Nessuno —</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
            ))}
          </Select>
        </Field>
      )}

      {state?.error && <p className="text-sm text-[--danger]">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Salvataggio…' : 'Aggiungi mutuo'}
      </Button>
    </form>
  )
}
