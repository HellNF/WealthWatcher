'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import { updateTransactionCategory } from '@/lib/transactions'

export async function updateCategoryAction(
  txnId: number,
  categoryId: number | null,
): Promise<void> {
  const user = await requireUser()
  updateTransactionCategory(user.id, txnId, categoryId)
  revalidatePath('/dashboard/accounts/[id]', 'page')
}
