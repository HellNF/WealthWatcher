'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getAccountForUser, updateAccount, deleteAccount, setAccountInterestRate } from '@/lib/accounts'

type State = { error?: string; success?: string } | undefined

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

// Imposta o azzera il tasso di interesse annuo lordo sulla giacenza (campo vuoto = rimuove).
export async function setInterestAction(
  accountId: number,
  _prev: State,
  formData: FormData,
): Promise<State> {
  const user = await requireUser()
  const raw = String(formData.get('rate') ?? '').trim().replace(',', '.')

  let rate: string | null = null
  if (raw !== '') {
    const n = Number(raw)
    if (!isFinite(n) || n < 0 || n > 100) return { error: 'Tasso non valido (0–100%)' }
    rate = String(n)
  }

  const ok = setAccountInterestRate(user.id, accountId, rate)
  if (!ok) return { error: 'Conto non trovato' }

  revalidatePath(`/dashboard/accounts/${accountId}`)
  return { success: rate ? 'Tasso aggiornato' : 'Tasso rimosso' }
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
