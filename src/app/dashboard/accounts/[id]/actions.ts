'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import { updateTransactionCategory, updateTransactionDescription, deleteTransaction } from '@/lib/transactions'
import { createCategoryRule } from '@/lib/merchants'

export async function updateCategoryAction(
  txnId: number,
  categoryId: number | null,
): Promise<void> {
  const user = await requireUser()
  updateTransactionCategory(user.id, txnId, categoryId)
  revalidatePath('/dashboard/accounts/[id]', 'page')
}

export async function createRuleFromCorrectionAction(
  pattern:    string,
  categoryId: number,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser()
  const result = createCategoryRule(user.id, pattern, categoryId)
  if (!result.ok) return { ok: false, error: result.error }
  revalidatePath('/dashboard/settings')
  return { ok: true }
}

export async function updateDescriptionAction(
  txnId:       number,
  description: string,
): Promise<void> {
  const user = await requireUser()
  updateTransactionDescription(user.id, txnId, description)
  revalidatePath('/dashboard/accounts/[id]', 'page')
}

export async function deleteTransactionAction(txnId: number): Promise<void> {
  const user = await requireUser()
  deleteTransaction(user.id, txnId)
  revalidatePath('/dashboard/accounts/[id]', 'page')
}
