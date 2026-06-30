// AES-256-GCM encryption for user secrets stored in DB (e.g. OpenAI API keys).
// Key derived from AUTH_SECRET via scrypt (deterministic, no separate key mgmt).
// Format: "iv_b64.tag_b64.ciphertext_b64" — all three parts base64url.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM  = 'aes-256-gcm'
const IV_BYTES   = 12   // 96-bit IV (GCM standard)
const TAG_BYTES  = 16   // 128-bit auth tag
const KEY_BYTES  = 32   // AES-256

// Derives a 32-byte key from AUTH_SECRET. Computed once per process start.
function deriveKey(): Buffer {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET not set — cannot encrypt/decrypt secrets')
  // Salt is constant (tied to this app's purpose, not a random per-ciphertext salt).
  const salt = Buffer.from('wealthwatcher-v1', 'utf8')
  return scryptSync(secret, salt, KEY_BYTES) as Buffer
}

let _key: Buffer | null = null
function getKey(): Buffer {
  if (!_key) _key = deriveKey()
  return _key
}

export function encryptSecret(plain: string): string {
  const key = getKey()
  const iv  = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ct  = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join('.')
}

export function decryptSecret(stored: string): string {
  const parts = stored.split('.')
  if (parts.length !== 3) throw new Error('Invalid encrypted secret format')
  const [ivB64, tagB64, ctB64] = parts
  const key     = getKey()
  const iv      = Buffer.from(ivB64, 'base64')
  const tag     = Buffer.from(tagB64, 'base64')
  const ct      = Buffer.from(ctB64, 'base64')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  try {
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
  } catch {
    throw new Error('Decryption failed — data may have been tampered with')
  }
}
