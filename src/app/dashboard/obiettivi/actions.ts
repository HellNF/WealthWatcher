'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import { createGoal, updateGoal, deleteGoal, allocateToGoal } from '@/lib/goals'

type ActionState = { error?: string; success?: string } | undefined

const dec = (v: string) => v.replace(',', '.')

const goalSchema = z.object({
  name:         z.string().min(1, 'Il nome è obbligatorio'),
  target_amount: z.string().transform(v => {
    const n = parseFloat(dec(v)); if (!isFinite(n) || n <= 0) throw new Error('Importo non valido'); return n
  }),
  target_date:  z.string().optional().transform(v => v && v !== '' ? v : null),
  color_hex:    z.string().optional().transform(v => v && v !== '' ? v : '#3b82f6'),
})

export async function createGoalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user  = await requireUser()
  const parse = goalSchema.safeParse({
    name:          formData.get('name'),
    target_amount: formData.get('target_amount'),
    target_date:   formData.get('target_date'),
    color_hex:     formData.get('color_hex'),
  })
  if (!parse.success) return { error: parse.error.issues[0].message }

  const d = parse.data
  createGoal(user.id, {
    name:              d.name,
    targetAmountMinor: Math.round(d.target_amount * 100),
    targetDate:        d.target_date,
    colorHex:          d.color_hex,
  })

  revalidatePath('/dashboard/obiettivi')
  return undefined
}

export async function deleteGoalAction(id: number): Promise<void> {
  const user = await requireUser()
  deleteGoal(user.id, id)
  revalidatePath('/dashboard/obiettivi')
}

export async function allocateGoalAction(
  goalId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user      = await requireUser()
  const direction = String(formData.get('direction') ?? 'in') // 'in' | 'out'
  const raw       = String(formData.get('amount') ?? '').replace(',', '.')
  const amount    = parseFloat(raw)

  if (isNaN(amount) || amount <= 0) return { error: 'Importo non valido' }

  const delta  = direction === 'out' ? -Math.round(amount * 100) : Math.round(amount * 100)
  const result = await allocateToGoal(user.id, goalId, delta)

  if (result === 'NOT_FOUND')                    return { error: 'Obiettivo non trovato' }
  if (result === 'INSUFFICIENT_UNALLOCATED_CASH') return { error: 'Liquidità insufficiente: non puoi allocare più della liquidità disponibile sui tuoi conti.' }

  revalidatePath('/dashboard/obiettivi')
}
