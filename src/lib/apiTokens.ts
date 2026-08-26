// src/lib/apiTokens.ts — Token API per accesso M2M in sola lettura (es. widget
// customapi di Homepage, gethomepage.dev). Vedi src/db/schema.ts:api_tokens
// per il perché è hashato e non cifrato: il chiaro non serve mai più dopo la
// creazione, solo un confronto contro l'hash in verifyApiToken().
import { createHash, randomBytes } from 'crypto'
import { sqlite } from '@/db'
import type { ApiToken } from '@/db/schema'

export type { ApiToken }

const TOKEN_PREFIX  = 'ww_'
const PREFIX_LENGTH = 10
const MAX_TOKENS_PER_USER = 10

function hashToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex')
}

export class TooManyTokensError extends Error {
  constructor() {
    super(`Limite di ${MAX_TOKENS_PER_USER} token attivi raggiunto — revocane uno prima di crearne un altro.`)
    this.name = 'TooManyTokensError'
  }
}

/**
 * Genera un nuovo token API per l'utente e lo persiste (solo l'hash).
 * Il valore in chiaro è ritornato UNA SOLA VOLTA: non è recuperabile dopo
 * questa chiamata, né dal DB né da questa funzione.
 */
export function createApiToken(userId: number, name: string): { token: string; row: ApiToken } {
  const activeCount = (
    sqlite
      .prepare(`SELECT COUNT(*) AS n FROM api_tokens WHERE owner_id = ? AND revoked_at IS NULL`)
      .get(userId) as { n: number }
  ).n
  if (activeCount >= MAX_TOKENS_PER_USER) throw new TooManyTokensError()

  const token = TOKEN_PREFIX + randomBytes(32).toString('base64url')
  const tokenHash = hashToken(token)
  const prefix = token.slice(0, PREFIX_LENGTH)

  const row = sqlite
    .prepare(`
      INSERT INTO api_tokens (owner_id, name, token_hash, prefix)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `)
    .get(userId, name, tokenHash, prefix) as ApiToken

  return { token, row }
}

export interface ApiTokenIdentity {
  tokenId: number
  userId:  number
}

/** Verifica un token in chiaro contro l'hash salvato. Ritorna null se non valido o revocato. */
export function verifyApiToken(raw: string): ApiTokenIdentity | null {
  if (!raw.startsWith(TOKEN_PREFIX)) return null
  const tokenHash = hashToken(raw)
  const row = sqlite
    .prepare(`SELECT id, owner_id FROM api_tokens WHERE token_hash = ? AND revoked_at IS NULL`)
    .get(tokenHash) as { id: number; owner_id: number } | undefined
  if (!row) return null
  return { tokenId: row.id, userId: row.owner_id }
}

// Non scrive ad ogni richiesta: un widget con refreshInterval basso non deve
// martellare il DB solo per aggiornare un timestamp informativo.
const TOUCH_THROTTLE_SECONDS = 60

export function touchApiToken(tokenId: number): void {
  sqlite
    .prepare(`
      UPDATE api_tokens
      SET last_used_at = unixepoch()
      WHERE id = ? AND (last_used_at IS NULL OR last_used_at < unixepoch() - ?)
    `)
    .run(tokenId, TOUCH_THROTTLE_SECONDS)
}

export function listApiTokens(userId: number): ApiToken[] {
  return sqlite
    .prepare(`SELECT * FROM api_tokens WHERE owner_id = ? ORDER BY created_at DESC`)
    .all(userId) as ApiToken[]
}

export function revokeApiToken(userId: number, id: number): boolean {
  const res = sqlite
    .prepare(`UPDATE api_tokens SET revoked_at = unixepoch() WHERE id = ? AND owner_id = ? AND revoked_at IS NULL`)
    .run(id, userId)
  return res.changes > 0
}

export function deleteApiToken(userId: number, id: number): boolean {
  const res = sqlite
    .prepare(`DELETE FROM api_tokens WHERE id = ? AND owner_id = ?`)
    .run(id, userId)
  return res.changes > 0
}
