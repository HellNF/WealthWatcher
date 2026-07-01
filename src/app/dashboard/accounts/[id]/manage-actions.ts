'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getAccountForUser, updateAccount, deleteAccount } from '@/lib/accounts'

type State = { error?: string } | undefined

export async function renameAccountAction(
  accountId: number,
  _prev: State,
  formData: FormData,
): Promise<State> {
  const user = await requireUser()
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'Nome obbligatorio' }
  if (name.length > 100) return { error: 'Nome troppo lungo' }

  const ok = updateAccount(user.id, accountId, { name })
  if (!ok) return { error: 'Conto non trovato' }

  revalidatePath(`/dashboard/accounts/${accountId}`)
  return undefined
}

// Elimina il conto e a cascata i suoi movimenti. Torna alla pagina istituzione.
export async function deleteAccountAction(accountId: number): Promise<void> {
  const user = await requireUser()
  const account = getAccountForUser(user.id, accountId)
  const institutionId = account?.institution_id

  deleteAccount(user.id, accountId)

  if (institutionId) {
    revalidatePath(`/dashboard/institutions/${institutionId}`)
    redirect(`/dashboard/institutions/${institutionId}`)
  }
  redirect('/dashboard')
}
