// src/lib/banking/connections.ts — Repository per eb_connections (consensi
// Open Banking / Enable Banking) e per il collegamento dei conti EB ai
// bank_accounts esistenti. Mirror di src/lib/institutions.ts /
// src/lib/accounts.ts: tutte le letture sono owner-scoped, le connessioni non
// sono condivisibili (a differenza di institutions/bank_accounts) perché
// contengono un consenso bancario personale.
import { randomBytes } from 'crypto'
import { and, desc, eq } from 'drizzle-orm'
import { db, sqlite } from '@/db'
import { bankAccounts, ebConnections } from '@/db/schema'
import type { BankAccount, EbConnection } from '@/db/schema'
import { encryptSecret, decryptSecret } from '@/lib/crypto'

export type { EbConnection }
export type ConnectionStatus = 'pending' | 'active' | 'expired' | 'revoked'

// ── Creazione + attivazione ────────────────────────────────────────────────

/**
 * Crea la riga 'pending' prima di reindirizzare l'utente alla banca. Il nonce
 * `state` generato qui va passato a `startAuth` e verrà riletto nel callback
 * per la verifica anti-CSRF (SPEC flusso OAuth-like).
 */
export function createPendingConnection(
  ownerId:       number,
  institutionId: number,
  aspspName:     string,
  aspspCountry:  string,
  validUntil:    Date,
): EbConnection {
  const state = randomBytes(24).toString('hex')
  const row = db
    .insert(ebConnections)
    .values({
      owner_id:       ownerId,
      institution_id: institutionId,
      aspsp_name:     aspspName,
      aspsp_country:  aspspCountry,
      status:         'pending',
      state,
      valid_until:    Math.floor(validUntil.getTime() / 1000),
    })
    .returning()
    .get()
  return row as EbConnection
}

/** Trova la connessione pending per `state` + proprietario (verifica anti-CSRF). */
export function getConnectionByStateForUser(userId: number, state: string): EbConnection | undefined {
  return db
    .select()
    .from(ebConnections)
    .where(and(eq(ebConnections.state, state), eq(ebConnections.owner_id, userId)))
    .get()
}

/** Segna la connessione attiva dopo lo scambio code→session (POST /sessions andato a buon fine). */
export function activateConnection(id: number, sessionId: string): void {
  db
    .update(ebConnections)
    .set({ status: 'active', session_id_enc: encryptSecret(sessionId) })
    .where(eq(ebConnections.id, id))
    .run()
}

/** session_id in chiaro, per le chiamate a getBalances/getTransactions/deleteSession. */
export function decryptSessionId(connection: EbConnection): string {
  if (!connection.session_id_enc) {
    throw new Error(`Connessione #${connection.id} non attiva: nessun session_id`)
  }
  return decryptSecret(connection.session_id_enc)
}

export function setConnectionStatus(id: number, status: ConnectionStatus): void {
  db.update(ebConnections).set({ status }).where(eq(ebConnections.id, id)).run()
}

export function markConnectionSynced(id: number): void {
  db
    .update(ebConnections)
    .set({ last_synced_at: Math.floor(Date.now() / 1000) })
    .where(eq(ebConnections.id, id))
    .run()
}

// ── Letture ────────────────────────────────────────────────────────────────

export function getConnectionForUser(userId: number, id: number): EbConnection | undefined {
  return db
    .select()
    .from(ebConnections)
    .where(and(eq(ebConnections.id, id), eq(ebConnections.owner_id, userId)))
    .get()
}

export function listConnectionsForUser(userId: number): EbConnection[] {
  return db
    .select()
    .from(ebConnections)
    .where(eq(ebConnections.owner_id, userId))
    .orderBy(desc(ebConnections.created_at))
    .all()
}

export function listConnectionsForInstitution(userId: number, institutionId: number): EbConnection[] {
  return db
    .select()
    .from(ebConnections)
    .where(and(eq(ebConnections.owner_id, userId), eq(ebConnections.institution_id, institutionId)))
    .orderBy(desc(ebConnections.created_at))
    .all()
}

/** Tutte le connessioni 'active' di tutti gli utenti — usata dallo script di sync schedulato. */
export function listActiveConnections(): EbConnection[] {
  return sqlite
    .prepare(`SELECT * FROM eb_connections WHERE status = 'active' ORDER BY id`)
    .all() as EbConnection[]
}

// ── Collegamento conti EB ↔ bank_accounts ─────────────────────────────────

/**
 * Collega (o ritrova, se già collegato) un conto EB a un bank_account sotto
 * l'istituzione della connessione. Idempotente su (eb_connection_id,
 * eb_account_uid): un callback rieseguito per errore non duplica i conti.
 */
export function linkOrCreateAccount(
  ownerId:       number,
  institutionId: number,
  connectionId:  number,
  ebAccountUid:  string,
  name:          string,
  currency:      string,
): BankAccount {
  const existing = db
    .select()
    .from(bankAccounts)
    .where(and(eq(bankAccounts.eb_connection_id, connectionId), eq(bankAccounts.eb_account_uid, ebAccountUid)))
    .get()
  if (existing) return existing as BankAccount

  const row = db
    .insert(bankAccounts)
    .values({
      owner_id:         ownerId,
      institution_id:   institutionId,
      name,
      currency,
      eb_account_uid:   ebAccountUid,
      eb_connection_id: connectionId,
    })
    .returning()
    .get()
  return row as BankAccount
}

export function listAccountsForConnection(connectionId: number): BankAccount[] {
  return db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.eb_connection_id, connectionId))
    .all()
}
