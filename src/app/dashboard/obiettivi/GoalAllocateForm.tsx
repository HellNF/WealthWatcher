'use client'

import { useActionState, useId, useState } from 'react'
import { Segmented } from '@/components/ui/Segmented'
import { allocateGoalAction } from './actions'
import { Button, Input } from '@/components/ui'
import { formatMoney } from '@/lib/format'

interface Props {
  goalId:        number
  freeMinor:     number
  allocatedMinor: number
}

export default function GoalAllocateForm({ goalId, freeMinor, allocatedMinor }: Props) {
  const action = allocateGoalAction.bind(null, goalId)
  const [state, formAction, pending] = useActionState(action, undefined)
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const fieldId = useId()

  const options = [
    { value: 'in' as const,  label: 'Alloca' },
    { value: 'out' as const, label: 'Preleva', disabled: allocatedMinor <= 0 },
  ]

  return (
    <form action={formAction} className="space-y-2.5">
      <input type="hidden" name="direction" value={direction} />

      <div className="flex gap-2 items-center flex-wrap">
        <Segmented label="Operazione" value={direction} onChange={setDirection} options={options} />

        <label htmlFor={fieldId} className="sr-only">Importo in euro</label>
        <Input
          id={fieldId}
          name="amount"
          inputMode="decimal"
          placeholder="Importo in €"
          className="flex-1 min-w-28 bg-(--surface)"
        />
        <Button type="submit" size="md" variant="secondary" loading={pending}>
          Conferma
        </Button>
      </div>

      <p className="text-xs text-(--muted) min-h-4" aria-live="polite">
        {state?.error ? <span className="text-(--danger-text)" role="alert">{state.error}</span>
          : state?.success ? <span className="text-(--ink)">{state.success}</span>
          : direction === 'in' && freeMinor >= 0 ? <>Liquidità libera: <span className="font-mono tabular-nums">{formatMoney(freeMinor, 'EUR')}</span></>
          : direction === 'out' ? <>Allocato: <span className="font-mono tabular-nums">{formatMoney(allocatedMinor, 'EUR')}</span></>
          : null}
      </p>
    </form>
  )
}
