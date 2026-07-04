'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getInstitutionForUser, updateInstitution, deleteInstitution } from '@/lib/institutions'
import { createAccount } from '@/lib/accounts'
import { createPortfolio } from '@/lib/portfolios'

const accountSchema = z.object({
  name:     z.string().trim().min(1, 'Nome obbligatorio').max(100),
  currency: z.string().trim().length(3, 'Valuta non valida (usa codice ISO a 3 lettere)').toUpperCase(),
})

const institutionSchema = z.object({
  name:    z.string().trim().min(1, 'Nome obbligatorio').max(100),
  kind:    z.enum(['bank', 'broker', 'both']),
  country: z.string().trim().toUpperCase()
             .regex(/^[A-Z]{2}$/, 'Usa il codice ISO di 2 lettere (es. IT, IE, DE)')
             .optional()
             .transform(v => (v === '' || v === undefined ? null : v)),
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

// ── Gestione istituzione (modifica nome/tipo, elimina) ────────────────────────

export async function updateInstitutionAction(
  institutionId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  const parsed = institutionSchema.safeParse({
    name:    formData.get('name'),
    kind:    formData.get('kind'),
    country: formData.get('country') ?? '',
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi' }
  }

  const ok = updateInstitution(user.id, institutionId, parsed.data)
  if (!ok) return { error: 'Istituzione non trovata' }

  revalidatePath(`/dashboard/institutions/${institutionId}`)
  revalidatePath('/dashboard')
  return undefined
}

// Elimina l'istituzione e a cascata conti/portafogli/movimenti. Torna al dashboard.
export async function deleteInstitutionAction(institutionId: number): Promise<void> {
  const user = await requireUser()
  deleteInstitution(user.id, institutionId)
  revalidatePath('/dashboard')
  redirect('/dashboard')
}
