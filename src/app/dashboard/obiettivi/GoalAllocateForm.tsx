'use client'

import { useActionState } from 'react'
import { useState } from 'react'
import { allocateGoalAction } from './actions'
import { Button, Field, Input } from '@/components/ui'
import { fromMinor } from '@/lib/money'

interface Props {
  goalId:        number
  freeMinor:     number
  allocatedMinor: number
}

export default function GoalAllocateForm({ goalId, freeMinor, allocatedMinor }: Props) {
  const action = allocateGoalAction.bind(null, goalId)
  const [state, formAction, pending] = useActionState(action, undefined)
  const [direction, setDirection] = useState<'in' | 'out'>('in')

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="direction" value={direction} />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setDirection('in')}
          className={[
            'flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors',
            direction === 'in'
              ? 'bg-[--brand-subtle] text-[--brand-text]'
              : 'text-[--muted] hover:text-[--ink]',
          ].join(' ')}
        >
          Alloca
        </button>
        <button
          type="button"
          onClick={() => setDirection('out')}
          disabled={allocatedMinor <= 0}
          className={[
            'flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors',
            direction === 'out'
              ? 'bg-[--surface-2] text-[--ink]'
              : 'text-[--muted] hover:text-[--ink]',
            allocatedMinor <= 0 ? 'opacity-40 cursor-not-allowed' : '',
          ].join(' ')}
        >
          Preleva
        </button>
      </div>

      <div className="flex gap-2 items-end">
        <Field label="" className="flex-1 mb-0">
          <Input
            name="amount"
            placeholder="€ importo"
            className="text-sm"
          />
        </Field>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? '…' : 'Conferma'}
        </Button>
      </div>

      {direction === 'in' && freeMinor >= 0 && (
        <p className="text-xs text-[--muted]">
          Disponibile: {fromMinor(freeMinor, 'EUR')}
        </p>
      )}

      {state?.error && <p className="text-xs text-[--danger]">{state.error}</p>}
      {state?.success && <p className="text-xs text-[--brand-text]">{state.success}</p>}
    </form>
  )
}
