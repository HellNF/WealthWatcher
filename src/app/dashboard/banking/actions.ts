'use server'
// src/app/dashboard/banking/actions.ts — Server actions per il flusso Open
// Banking (Enable Banking): avvio consenso, sync manuale, disconnessione.
// Stesso pattern owner-check di src/app/dashboard/accounts/[id]/import/actions.ts.
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getInstitutionForUser } from '@/lib/institutions'
import { startAuth, deleteSession } from '@/lib/banking/client'
import { getEnableBankingKey } from '@/lib/userSettings'
import {
  createPendingConnection,
  getConnectionForUser,
  decryptSessionId,
  setConnectionStatus,
} from '@/lib/banking/connections'
import { syncConnection } from '@/lib/banking/sync'

export type ActionState = { error?: string } | undefined

// Durata del consenso richiesto alla banca (SPEC apre §Enable Banking): 90
// giorni è un compromesso comune fra sicurezza e frequenza di riautorizzazione.
const CONSENT_DAYS = 90

/**
 * Avvia il consenso: crea la connessione 'pending', chiede a Enable Banking
 * l'URL della banca e vi reindirizza il browser. `redirect()` lancia
 * internamente — è la modalità corretta per una server action invocata da
 * un componente client (naviga anche verso URL esterni).
 *
 * La configurazione server (ENABLE_BANKING_REDIRECT_URL) va verificata PRIMA
 * di creare la riga 'pending': un errore qui non deve mai lasciare una
 * connessione orfana che l'utente vede bloccata su "in attesa" senza spiegazione.
 */
export async function startConnectAction(
  institutionId: number,
  aspspName:     string,
  aspspCountry:  string,
): Promise<ActionState> {
  const user = await requireUser()
  const institution = getInstitutionForUser(user.id, institutionId)
  if (!institution) return { error: 'Istituzione non trovata' }

  const creds = getEnableBankingKey(user.id)
  if (!creds) {
    return { error: 'Configura prima la tua chiave Enable Banking nelle impostazioni.' }
  }

  const redirectUrl = process.env.ENABLE_BANKING_REDIRECT_URL
  if (!redirectUrl) {
    return { error: 'Configurazione server incompleta: ENABLE_BANKING_REDIRECT_URL non impostata.' }
  }

  const validUntil = new Date(Date.now() + CONSENT_DAYS * 86_400_000)
  const connection = createPendingConnection(user.id, institutionId, aspspName, aspspCountry, validUntil)

  // Difesa in profondità: qualunque errore imprevisto (non solo un null di
  // ritorno) deve comunque marcare la connessione come fallita, mai lasciarla
  // 'pending' senza che l'utente possa capire cosa è successo o ritentare.
  let auth: Awaited<ReturnType<typeof startAuth>>
  try {
    auth = await startAuth(creds, {
      aspspName,
      aspspCountry,
      state: connection.state,
      redirectUrl,
      validUntil: validUntil.toISOString(),
    })
  } catch (err) {
    console.warn('[enablebanking] startAuth ha lanciato un errore inatteso:', err)
    auth = null
  }

  if (!auth) {
    setConnectionStatus(connection.id, 'revoked')
    return { error: 'Impossibile avviare il collegamento con la banca. Riprova più tardi.' }
  }

  redirect(auth.url)
}

export interface SyncActionResult {
  insertedCount:  number
  duplicateCount: number
  error?:         string
}

export async function syncConnectionAction(connectionId: number): Promise<SyncActionResult> {
  const user = await requireUser()
  const connection = getConnectionForUser(user.id, connectionId)
  if (!connection) return { insertedCount: 0, duplicateCount: 0, error: 'Connessione non trovata' }
  if (connection.status !== 'active') {
    return {
      insertedCount:  0,
      duplicateCount: 0,
      error: connection.status === 'expired'
        ? 'Connessione scaduta: riconnetti la banca.'
        : 'Connessione non attiva.',
    }
  }

  const result = await syncConnection(connection)
  revalidatePath(`/dashboard/institutions/${connection.institution_id}`)

  if (result.status === 'expired') {
    return { insertedCount: 0, duplicateCount: 0, error: 'Connessione scaduta: riconnetti la banca.' }
  }
  if (result.status === 'no-credentials') {
    return { insertedCount: 0, duplicateCount: 0, error: 'Chiave Enable Banking mancante: reimpostala nelle impostazioni.' }
  }

  return {
    insertedCount:  result.accounts.reduce((s, a) => s + a.insertedCount, 0),
    duplicateCount: result.accounts.reduce((s, a) => s + a.duplicateCount, 0),
    error:          result.accounts.find((a) => a.error)?.error,
  }
}

export async function disconnectAction(connectionId: number): Promise<void> {
  const user = await requireUser()
  const connection = getConnectionForUser(user.id, connectionId)
  if (!connection) return

  const creds = getEnableBankingKey(user.id)
  if (connection.session_id_enc && creds) {
    try {
      await deleteSession(creds, decryptSessionId(connection))
    } catch (err) {
      console.warn('[enablebanking] revoca sessione fallita:', err)
    }
  }

  setConnectionStatus(connectionId, 'revoked')
  revalidatePath(`/dashboard/institutions/${connection.institution_id}`)
}
