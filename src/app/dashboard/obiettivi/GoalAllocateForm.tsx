'use client'

import { useActionState, useId, useState } from 'react'
import { motion, LayoutGroup, useReducedMotion } from 'motion/react'
import { allocateGoalAction } from './actions'
import { Button, Input } from '@/components/ui'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/cn'

interface Props {
  goalId:        number
  freeMinor:     number
  allocatedMinor: number
}

export default function GoalAllocateForm({ goalId, freeMinor, allocatedMinor }: Props) {
  const action = allocateGoalAction.bind(null, goalId)
  const [state, formAction, pending] = useActionState(action, undefined)
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const reduceMotion = useReducedMotion()
  const fieldId = useId()

  const options = [
    { key: 'in' as const,  label: 'Alloca',  disabled: false },
    { key: 'out' as const, label: 'Preleva', disabled: allocatedMinor <= 0 },
  ]

  return (
    <form action={formAction} className="space-y-2.5">
      <input type="hidden" name="direction" value={direction} />

      <div className="flex gap-2 items-center flex-wrap">
        <LayoutGroup id={`goal-dir-${goalId}`}>
          <div role="radiogroup" aria-label="Operazione" className="inline-flex items-center gap-0.5 rounded-lg bg-(--surface-2) p-0.5">
            {options.map((o) => {
              const selected = direction === o.key
              return (
                <button
                  key={o.key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={o.disabled}
                  onClick={() => setDirection(o.key)}
                  className={cn(
                    'relative h-8 px-3 rounded-md text-sm font-medium cursor-pointer select-none',
                    'transition-[color,transform] duration-150 ease-out-strong active:scale-[0.97]',
                    'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--ring)',
                    'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
                    selected ? 'text-(--ink)' : 'text-(--muted) hover:text-(--ink)',
                  )}
                >
                  {selected && (
                    <motion.span
                      layoutId="goal-dir-pill"
                      className="absolute inset-0 rounded-md bg-(--surface) shadow-(--shadow-sm) ring-1 ring-(--border)"
                      transition={reduceMotion ? { duration: 0 } : { type: 'spring', duration: 0.3, bounce: 0 }}
                    />
                  )}
                  <span className="relative">{o.label}</span>
                </button>
              )
            })}
          </div>
        </LayoutGroup>

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
