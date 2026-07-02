'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import { setOpenAiKey, clearOpenAiKey } from '@/lib/userSettings'
import { addAllowedEmail, removeAllowedEmail, updateAllowedEmailRole, normalizeEmail } from '@/lib/users'

type ActionState = { error?: string; success?: string } | undefined

const keySchema = z.string()
  .min(1, 'La chiave non può essere vuota')
  .startsWith('sk-', 'La chiave OpenAI deve iniziare con "sk-"')

export async function saveOpenAiKeyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  const parse = keySchema.safeParse(formData.get('openai_key'))
  if (!parse.success) return { error: parse.error.issues[0].message }

  setOpenAiKey(user.id, parse.data)
  revalidatePath('/dashboard/settings', 'page')
  return { success: 'Chiave salvata' }
}

export async function removeOpenAiKeyAction(): Promise<ActionState> {
  const user = await requireUser()
  clearOpenAiKey(user.id)
  revalidatePath('/dashboard/settings', 'page')
  return { success: 'Chiave rimossa' }
}

// ── Whitelist (solo admin) ────────────────────────────────────────────────────

const emailSchema = z.string().email('Email non valida').max(254)
const roleSchema  = z.enum(['admin', 'member'])

async function requireAdmin() {
  const user = await requireUser()
  if (user.role !== 'admin') throw new Error('Non autorizzato')
  return user
}

export async function addAllowedEmailAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()
  const emailParse = emailSchema.safeParse(formData.get('email'))
  if (!emailParse.success) return { error: emailParse.error.issues[0].message }
  const roleParse = roleSchema.safeParse(formData.get('role') ?? 'member')
  if (!roleParse.success) return { error: 'Ruolo non valido' }

  addAllowedEmail(emailParse.data, roleParse.data)
  revalidatePath('/dashboard/settings', 'page')
  return { success: `${emailParse.data} aggiunta alla whitelist` }
}

export async function removeAllowedEmailAction(email: string): Promise<ActionState> {
  const user = await requireAdmin()
  if (normalizeEmail(email) === normalizeEmail(user.email ?? '')) {
    return { error: 'Non puoi rimuovere la tua stessa email' }
  }
  removeAllowedEmail(email)
  revalidatePath('/dashboard/settings', 'page')
}

export async function updateAllowedEmailRoleAction(email: string, role: string): Promise<ActionState> {
  const user = await requireAdmin()
  if (normalizeEmail(email) === normalizeEmail(user.email ?? '')) {
    return { error: 'Non puoi cambiare il tuo ruolo' }
  }
  const roleParse = roleSchema.safeParse(role)
  if (!roleParse.success) return { error: 'Ruolo non valido' }
  updateAllowedEmailRole(email, roleParse.data)
  revalidatePath('/dashboard/settings', 'page')
}
