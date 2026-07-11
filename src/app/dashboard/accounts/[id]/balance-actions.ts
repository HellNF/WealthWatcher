'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import { getAccountForUser, setAccountBalanceAnchor, clearAccountBalanceAnchor } from '@/lib/accounts'
import { toMinor } from '@/lib/money'
import { refreshNetWorth } from '@/lib/valuation'

type State = { error?: string; success?: string } | undefined

// Imposta il saldo di riferimento del conto (importo reale a una data). Da qui in
// poi il saldo mostrato = questo importo + i movimenti con data successiva.
export async function setBalanceAction(
  accountId: number,
  _prev: State,
  formData: FormData,
): Promise<State> {
  const user = await requireUser()
  const account = getAccountForUser(user.id, accountId)
  if (!account) return { error: 'Conto non trovato' }

  const rawAmount = String(formData.get('amount') ?? '').trim().replace(',', '.')
  const date = String(formData.get('date') ?? '').trim()

  if (!rawAmount || isNaN(Number(rawAmount))) {
    return { error: 'Inserisci un importo valido' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: 'Data non valida' }
  }

  let balanceMinor: number
  try {
    balanceMinor = toMinor(Number(rawAmount).toFixed(2), account.currency)
  } catch {
    return { error: 'Importo fuori scala' }
  }

  setAccountBalanceAnchor(user.id, accountId, balanceMinor, date)
  await refreshNetWorth(user.id)
  revalidatePath(`/dashboard/accounts/${accountId}`)
  return { success: 'Saldo di riferimento impostato' }
}

// Rimuove il saldo di riferimento → il saldo torna alla somma di tutti i movimenti.
export async function clearBalanceAction(accountId: number): Promise<void> {
  const user = await requireUser()
  const account = getAccountForUser(user.id, accountId)
  if (!account) return
  clearAccountBalanceAnchor(user.id, accountId)
  await refreshNetWorth(user.id)
  revalidatePath(`/dashboard/accounts/${accountId}`)
}
