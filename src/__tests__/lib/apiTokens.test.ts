// src/__tests__/lib/apiTokens.test.ts
import { sqlite } from '@/db'
import {
  createApiToken, verifyApiToken, touchApiToken,
  listApiTokens, revokeApiToken, deleteApiToken, TooManyTokensError,
} from '@/lib/apiTokens'

let userId: number
let otherUserId: number

beforeAll(() => {
  sqlite.prepare(`INSERT INTO users (email, name, role) VALUES ('apitok@example.com', 'Api Token Test', 'member')`).run()
  userId = (sqlite.prepare(`SELECT id FROM users WHERE email = 'apitok@example.com'`).get() as { id: number }).id

  sqlite.prepare(`INSERT INTO users (email, name, role) VALUES ('apitok2@example.com', 'Api Token Test 2', 'member')`).run()
  otherUserId = (sqlite.prepare(`SELECT id FROM users WHERE email = 'apitok2@example.com'`).get() as { id: number }).id
})

afterAll(() => {
  sqlite.prepare(`DELETE FROM api_tokens WHERE owner_id IN (?, ?)`).run(userId, otherUserId)
  sqlite.prepare(`DELETE FROM users WHERE id IN (?, ?)`).run(userId, otherUserId)
})

afterEach(() => {
  sqlite.prepare(`DELETE FROM api_tokens WHERE owner_id IN (?, ?)`).run(userId, otherUserId)
})

test('createApiToken genera un token che inizia con ww_ e non lo persiste in chiaro', () => {
  const { token, row } = createApiToken(userId, 'Test token')
  expect(token).toMatch(/^ww_/)
  expect(row.prefix).toBe(token.slice(0, 10))

  const stored = sqlite.prepare(`SELECT token_hash FROM api_tokens WHERE id = ?`).get(row.id) as { token_hash: string }
  expect(stored.token_hash).not.toBe(token)
  expect(stored.token_hash).toHaveLength(64) // sha256 hex
})

test('verifyApiToken riconosce un token valido e ritorna il proprietario corretto', () => {
  const { token } = createApiToken(userId, 'Test token')
  const identity = verifyApiToken(token)
  expect(identity).not.toBeNull()
  expect(identity!.userId).toBe(userId)
})

test('verifyApiToken rifiuta un token mai emesso', () => {
  expect(verifyApiToken('ww_inesistente')).toBeNull()
})

test('verifyApiToken rifiuta un token senza il prefisso atteso', () => {
  expect(verifyApiToken('qualcosa-a-caso')).toBeNull()
})

test('verifyApiToken rifiuta un token revocato', () => {
  const { token, row } = createApiToken(userId, 'Da revocare')
  expect(verifyApiToken(token)).not.toBeNull()

  const revoked = revokeApiToken(userId, row.id)
  expect(revoked).toBe(true)
  expect(verifyApiToken(token)).toBeNull()
})

test('revokeApiToken è owner-only', () => {
  const { row } = createApiToken(userId, 'Di userId')
  const result = revokeApiToken(otherUserId, row.id)
  expect(result).toBe(false)

  const stillActive = sqlite.prepare(`SELECT revoked_at FROM api_tokens WHERE id = ?`).get(row.id) as { revoked_at: number | null }
  expect(stillActive.revoked_at).toBeNull()
})

test('touchApiToken imposta last_used_at', () => {
  const { row } = createApiToken(userId, 'Da toccare')
  let stored = sqlite.prepare(`SELECT last_used_at FROM api_tokens WHERE id = ?`).get(row.id) as { last_used_at: number | null }
  expect(stored.last_used_at).toBeNull()

  touchApiToken(row.id)
  stored = sqlite.prepare(`SELECT last_used_at FROM api_tokens WHERE id = ?`).get(row.id) as { last_used_at: number | null }
  expect(stored.last_used_at).not.toBeNull()
})

test('listApiTokens elenca solo i token dell\'utente, mai il valore in chiaro', () => {
  createApiToken(userId, 'A')
  createApiToken(userId, 'B')
  createApiToken(otherUserId, 'C')

  const tokens = listApiTokens(userId)
  expect(tokens).toHaveLength(2)
  for (const t of tokens) {
    expect(t).not.toHaveProperty('token')
    expect((t as unknown as Record<string, unknown>).token_hash).toBeDefined()
  }
})

test('deleteApiToken è owner-only e rimuove la riga', () => {
  const { row } = createApiToken(userId, 'Da eliminare')
  expect(deleteApiToken(otherUserId, row.id)).toBe(false)
  expect(deleteApiToken(userId, row.id)).toBe(true)
  expect(sqlite.prepare(`SELECT id FROM api_tokens WHERE id = ?`).get(row.id)).toBeUndefined()
})

test('rifiuta la creazione oltre il limite massimo di token attivi', () => {
  for (let i = 0; i < 10; i++) createApiToken(userId, `Token ${i}`)
  expect(() => createApiToken(userId, 'Undicesimo')).toThrow(TooManyTokensError)
})
