'use client'

import { useActionState } from 'react'
import { createGoalAction } from './actions'
import { Button, Field, Input } from '@/components/ui'

export default function GoalForm() {
  const [state, action, pending] = useActionState(createGoalAction, undefined)

  return (
    <form action={action} className="space-y-4">
      <Field label="Nome obiettivo">
        <Input name="name" placeholder="Es. Fondo emergenza, Vacanza, Auto" required />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Importo target (€)">
          <Input name="target_amount" inputMode="decimal" placeholder="5000" required />
        </Field>
        <Field label="Entro il" hint="Opzionale: serve a calcolare quanto mettere da parte al mese">
          <Input name="target_date" type="date" />
        </Field>
      </div>

      <Field label="Colore" hint="Per identificare l'obiettivo visivamente">
        <input
          name="color_hex"
          type="color"
          defaultValue="#3b82f6"
          className="h-9 w-16 rounded-lg border border-(--border) bg-(--surface-2) p-1 cursor-pointer"
        />
      </Field>

      {state?.error && <p className="text-sm text-(--danger-text)" role="alert">{state.error}</p>}

      <Button type="submit" loading={pending}>
        Crea obiettivo
      </Button>
    </form>
  )
}
