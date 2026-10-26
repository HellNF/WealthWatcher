// src/lib/banking/connections.ts — Repository per eb_connections (consensi
// Open Banking / Enable Banking) e per il collegamento dei conti EB ai
// bank_accounts esistenti. Mirror di src/lib/institutions.ts /
// src/lib/accounts.ts: tutte le letture sono owner-scoped, le connessioni non
// sono condivisibili (a differenza di institutions/bank_accounts) perché
// contengono un consenso bancario personale.
import { createHash, randomBytes } from 'crypto'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { db, sqlite } from '@/db'
import { bankAccounts, ebConnections } from '@/db/schema'
import type { BankAccount, EbConnection } from '@/db/schema'
import { encryptSecret, decryptSecret } from '@/lib/crypto'
import type { EbAccount } from './types'

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
 * Chiave stabile di un conto EB tra consensi diversi. Preferisce
 * `identification_hash` (pensato da Enable Banking proprio per riconoscere lo
 * stesso conto in sessioni diverse); se l'ASPSP non lo fornisce ripiega su un
 * hash dell'IBAN, così nel DB non finisce il numero di conto in chiaro.
 */
export function ebAccountKey(account: Pick<EbAccount, 'identification_hash' | 'account_id' | 'iban'>): string | null {
  if (account.identification_hash) return account.identification_hash
  const iban = account.account_id?.iban ?? account.iban
  if (!iban) return null
  const normalized = iban.replace(/\s+/g, '').toUpperCase()
  return `iban:${createHash('sha256').update(normalized).digest('hex')}`
}

/** Sposta un bank_account esistente sul nuovo consenso (uid e connessione nuovi). */
function relinkAccount(accountId: number, connectionId: number, ebAccountUid: string, accountKey: string | null): BankAccount {
  return db
    .update(bankAccounts)
    .set({
      eb_account_uid:   ebAccountUid,
      eb_connection_id: connectionId,
      ...(accountKey ? { eb_account_key: accountKey } : {}),
    })
    .where(eq(bankAccounts.id, accountId))
    .returning()
    .get() as BankAccount
}

/**
 * Collega un conto EB a un bank_account sotto l'istituzione della connessione.
 * L'uid EB vale solo per la sessione che lo ha emesso: quando l'utente rinnova
 * un consenso scaduto la banca restituisce uid nuovi per gli stessi conti.
 * Per non spezzare lo storico in due conti, l'ordine di ricerca è:
 *  1. stesso (connessione, uid) — callback rieseguito: idempotente;
 *  2. stessa chiave stabile (ebAccountKey) nell'istituzione — consenso
 *     rinnovato: il conto esistente viene ricollegato alla nuova connessione;
 *  3. conti collegati prima che la chiave venisse salvata: un solo conto con
 *     stesso nome e valuta, legato a una connessione non più attiva.
 * Solo se nessuno corrisponde viene creato un conto nuovo.
 */
export function linkOrCreateAccount(
  ownerId:       number,
  institutionId: number,
  connectionId:  number,
  ebAccountUid:  string,
  name:          string,
  currency:      string,
  accountKey:    string | null = null,
): BankAccount {
  const existing = db
    .select()
    .from(bankAccounts)
    .where(and(eq(bankAccounts.eb_connection_id, connectionId), eq(bankAccounts.eb_account_uid, ebAccountUid)))
    .get()
  if (existing) {
    if (accountKey && !existing.eb_account_key) return relinkAccount(existing.id, connectionId, ebAccountUid, accountKey)
    return existing as BankAccount
  }

  const sameInstitution = and(eq(bankAccounts.owner_id, ownerId), eq(bankAccounts.institution_id, institutionId))

  if (accountKey) {
    // Se per un errore passato esistono più conti con la stessa chiave, il più
    // vecchio è quello con lo storico più lungo.
    const byKey = db
      .select()
      .from(bankAccounts)
      .where(and(sameInstitution, eq(bankAccounts.eb_account_key, accountKey)))
      .orderBy(asc(bankAccounts.id))
      .get()
    if (byKey) return relinkAccount(byKey.id, connectionId, ebAccountUid, accountKey)
  }

  const legacy = sqlite
    .prepare(
      `SELECT a.id FROM bank_accounts a
         LEFT JOIN eb_connections c ON c.id = a.eb_connection_id
        WHERE a.owner_id = ? AND a.institution_id = ?
          AND a.eb_account_uid IS NOT NULL AND a.eb_account_key IS NULL
          AND a.name = ? AND a.currency = ?
          AND (c.id IS NULL OR (c.id <> ? AND c.status <> 'active'))`,
    )
    .all(ownerId, institutionId, name, currency, connectionId) as { id: number }[]
  if (legacy.length === 1) return relinkAccount(legacy[0].id, connectionId, ebAccountUid, accountKey)

  const row = db
    .insert(bankAccounts)
    .values({
      owner_id:         ownerId,
      institution_id:   institutionId,
      name,
      currency,
      eb_account_uid:   ebAccountUid,
      eb_connection_id: connectionId,
      eb_account_key:   accountKey,
    })
    .returning()
    .get()
  return row as BankAccount
}

/** Salva la chiave stabile su un conto collegato prima che venisse memorizzata. */
export function setAccountKey(accountId: number, accountKey: string): void {
  db
    .update(bankAccounts)
    .set({ eb_account_key: accountKey })
    .where(and(eq(bankAccounts.id, accountId), isNull(bankAccounts.eb_account_key)))
    .run()
}

export function listAccountsForConnection(connectionId: number): BankAccount[] {
  return db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.eb_connection_id, connectionId))
    .all()
}
