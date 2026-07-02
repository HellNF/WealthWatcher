'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import { updateTransactionCategory } from '@/lib/transactions'
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
