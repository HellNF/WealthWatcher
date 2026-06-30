'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import { getInstitutionForUser } from '@/lib/institutions'
import { createAccount } from '@/lib/accounts'
import { createPortfolio } from '@/lib/portfolios'

const accountSchema = z.object({
  name:     z.string().trim().min(1, 'Nome obbligatorio').max(100),
  currency: z.string().trim().length(3, 'Valuta non valida (usa codice ISO a 3 lettere)').toUpperCase(),
})

export type ActionState = { error?: string } | undefined

export async function addAccount(
  institutionId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()

  // Verify the institution belongs to this user (ownership re-check at data source)
  const institution = getInstitutionForUser(user.id, institutionId)
  if (!institution) return { error: 'Istituzione non trovata' }

  const parsed = accountSchema.safeParse({
    name:     formData.get('name'),
    currency: formData.get('currency'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi' }
  }

  createAccount(user.id, institutionId, parsed.data.name, parsed.data.currency)
  revalidatePath(`/dashboard/institutions/${institutionId}`)
  return undefined
}

export async function addPortfolio(
  institutionId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  const institution = getInstitutionForUser(user.id, institutionId)
  if (!institution) return { error: 'Istituzione non trovata' }

  const parsed = accountSchema.safeParse({
    name:     formData.get('name'),
    currency: formData.get('currency'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi' }
  }

  createPortfolio(user.id, institutionId, parsed.data.name, parsed.data.currency)
  revalidatePath(`/dashboard/institutions/${institutionId}`)
  return undefined
}
