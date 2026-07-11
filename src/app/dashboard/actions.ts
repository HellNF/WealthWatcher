// src/app/dashboard/actions.ts
'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import { signOut } from '@/auth'
import { createInstitution } from '@/lib/institutions'
import { getProvider } from '@/lib/providers'
import { setDashboardLayout, type WidgetConfig } from '@/lib/userSettings'
import { refreshNetWorth } from '@/lib/valuation'

const customSchema = z.object({
  name:    z.string().trim().min(1, 'Nome obbligatorio').max(100),
  kind:    z.enum(['bank', 'broker', 'both']),
  country: z.string().trim().toUpperCase()
             .regex(/^[A-Z]{2}$/, 'Usa il codice ISO di 2 lettere (es. IT, IE, DE)')
             .optional()
             .transform(v => (v === '' || v === undefined ? null : v)),
})

export type ActionState = { error?: string } | undefined

// `provider` = id catalogo, oppure '' per banca personalizzata (usa name+kind).
export async function addInstitution(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Authorization re-checked at the data source, never trusted from the client.
  const user = await requireUser()

  const providerId = String(formData.get('provider') ?? '').trim()

  if (providerId) {
    const provider = getProvider(providerId)
    if (!provider) return { error: 'Banca non riconosciuta' }
    createInstitution(user.id, provider.name, provider.defaultKind, provider.id)
    revalidatePath('/dashboard')
    return undefined
  }

  // Banca personalizzata: nome libero + tipo + paese opzionale, nessun import estratto conto.
  const parsed = customSchema.safeParse({
    name:    formData.get('name'),
    kind:    formData.get('kind'),
    country: formData.get('country') ?? '',
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi' }
  }

  createInstitution(user.id, parsed.data.name, parsed.data.kind, null, parsed.data.country ?? null)
  revalidatePath('/dashboard')
  return undefined
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/login' })
}

/** Persiste l'ordine e la visibilità dei widget dashboard per l'utente corrente. */
export async function saveDashboardLayoutAction(layout: WidgetConfig[]): Promise<void> {
  const user = await requireUser()
  setDashboardLayout(user.id, layout)
  revalidatePath('/dashboard')
}

/**
 * Ricalcola lo snapshot di oggi su richiesta esplicita (bottone di refresh nella
 * dashboard). ensureTodaySnapshot calcola solo se manca lo snapshot odierno —
 * questa forza il ricalcolo anche se esiste già, utile subito dopo un'operazione
 * che non passa per una server action che già chiama refreshNetWorth (es. un
 * prezzo di mercato appena aggiornato altrove).
 */
export async function refreshNetWorthAction(): Promise<void> {
  const user = await requireUser()
  await refreshNetWorth(user.id)
  revalidatePath('/dashboard')
}
