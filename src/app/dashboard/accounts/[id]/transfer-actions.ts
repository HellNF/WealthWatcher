'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import { confirmTransfer, rejectTransfer, undoTransfer, type TransferDecisionError } from '@/lib/transfers'

const MESSAGES: Record<TransferDecisionError, string> = {
  'not-found':            'Movimento non trovato.',
  'not-a-pair':           'I due movimenti non sono speculari: importo, valuta o conto non corrispondono.',
  'already-confirmed':    'Uno dei due movimenti fa già parte di un giroconto confermato.',
  'no-transfer-category': 'Manca una categoria di tipo trasferimento.',
}

const validId = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) > 0

export async function confirmTransferAction(outflowId: number, inflowId: number): Promise<{ error?: string }> {
  const user = await requireUser()
  if (!validId(outflowId) || !validId(inflowId)) return { error: MESSAGES['not-found'] }
  const result = confirmTransfer(user.id, outflowId, inflowId)
  revalidatePath('/dashboard', 'layout')
  return result.ok ? {} : { error: MESSAGES[result.error] }
}

export async function rejectTransferAction(outflowId: number, inflowId: number): Promise<{ error?: string }> {
  const user = await requireUser()
  if (!validId(outflowId) || !validId(inflowId)) return { error: MESSAGES['not-found'] }
  const result = rejectTransfer(user.id, outflowId, inflowId)
  revalidatePath('/dashboard', 'layout')
  return result.ok ? {} : { error: MESSAGES[result.error] }
}

export async function undoTransferAction(linkId: number): Promise<{ error?: string }> {
  const user = await requireUser()
  if (!validId(linkId) || !undoTransfer(user.id, linkId)) return { error: 'Giroconto non trovato.' }
  revalidatePath('/dashboard', 'layout')
  return {}
}
