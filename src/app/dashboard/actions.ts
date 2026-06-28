// src/app/dashboard/actions.ts
'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import { signOut } from '@/auth'
import { createInstitution } from '@/lib/institutions'

const institutionSchema = z.object({
  name: z.string().trim().min(1, 'Nome obbligatorio').max(100),
  kind: z.enum(['bank', 'broker', 'both']),
})

export type ActionState = { error?: string } | undefined

export async function addInstitution(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Authorization re-checked at the data source, never trusted from the client.
  const user = await requireUser()

  const parsed = institutionSchema.safeParse({
    name: formData.get('name'),
    kind: formData.get('kind'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi' }
  }

  createInstitution(user.id, parsed.data.name, parsed.data.kind)
  revalidatePath('/dashboard')
  return undefined
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/login' })
}
