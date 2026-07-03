'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import { upsertBudget, deleteBudget } from '@/lib/budgets'

type ActionState = { error?: string; success?: string } | undefined

/** Converte un importo decimale IT (es. "1.200,50") in minor units. */
function parseAmountMinor(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? '')
    .trim()
    .replace(/\./g, '')   // rimuovi separatore migliaia
    .replace(',', '.')    // virgola decimale IT → punto
  if (!s) return null
  const n = parseFloat(s)
  if (isNaN(n) || n <= 0) return null
  return Math.round(n * 100)
}

export async function saveBudgetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user        = await requireUser()
  const categoryRaw = formData.get('category_id')
  const categoryId  = categoryRaw === '' || categoryRaw === null
    ? null
    : parseInt(String(categoryRaw), 10)

  if (categoryId !== null && isNaN(categoryId)) {
    return { error: 'Categoria non valida.' }
  }

  const amountMinor = parseAmountMinor(formData.get('amount'))
  if (amountMinor === null || amountMinor <= 0) {
    return { error: 'Inserisci un importo valido e positivo.' }
  }

  upsertBudget(user.id, categoryId, amountMinor)
  revalidatePath('/dashboard/budgets')
  return { success: 'Budget salvato.' }
}

export async function deleteBudgetAction(id: number): Promise<void> {
  const user = await requireUser()
  deleteBudget(id, user.id)
  revalidatePath('/dashboard/budgets')
}
