'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import { setOpenAiKey, clearOpenAiKey } from '@/lib/userSettings'

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
