'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import {
  clearRecurringDecision, isValidRecurringKey, setRecurringDecision, type RecurringDecision,
} from '@/lib/recurringDecisions'

export async function decideRecurringAction(key: string, label: string, status: RecurringDecision): Promise<void> {
  const user = await requireUser()
  if (!isValidRecurringKey(key) || typeof label !== 'string' || (status !== 'confirmed' && status !== 'dismissed')) {
    throw new Error('Richiesta non valida')
  }
  setRecurringDecision(user.id, key, label.trim() || key, status)
  revalidatePath('/dashboard', 'layout')
}

export async function clearRecurringDecisionAction(key: string): Promise<void> {
  const user = await requireUser()
  if (!isValidRecurringKey(key)) throw new Error('Richiesta non valida')
  clearRecurringDecision(user.id, key)
  revalidatePath('/dashboard', 'layout')
}
