// AES-256-GCM encryption for user secrets stored in DB (OpenAI API keys,
// chiavi private Enable Banking, session_id bancari).
//
// Envelope versionato — v1 (legacy) vs v2 (corrente):
//   v1: "iv_b64.tag_b64.ciphertext_b64"        — chiave = scrypt(AUTH_SECRET, 'wealthwatcher-v1')
//   v2: "v2." + "iv_b64.tag_b64.ciphertext_b64" — chiave = scrypt(DATA_ENCRYPTION_KEY ?? AUTH_SECRET, 'wealthwatcher-v2')
//
// Perché due versioni: prima, TUTTA la cifratura a riposo derivava da
// AUTH_SECRET con un salt fisso — ruotare AUTH_SECRET (es. dopo un leak)
// rendeva irrecuperabili anche i segreti già cifrati, perché sessioni Auth.js
// e segreti utente condividevano lo stesso materiale crittografico. v2
// introduce DATA_ENCRYPTION_KEY come chiave dedicata (fallback ad AUTH_SECRET
// se non impostata) con un salt diverso da v1: chi imposta una
// DATA_ENCRYPTION_KEY separata può ruotare AUTH_SECRET senza invalidare i
// segreti già cifrati.
//
// Le NUOVE cifrature (encryptSecret) usano sempre v2. decryptSecret continua
// a capire il formato v1 per i dati già a riposo — nessuna migrazione forzata:
// ogni segreto passa a v2 la prossima volta che viene riscritto (es. l'utente
// aggiorna la sua chiave OpenAI).
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM  = 'aes-256-gcm'
const IV_BYTES   = 12   // 96-bit IV (GCM standard)
const TAG_BYTES  = 16   // 128-bit auth tag
const KEY_BYTES  = 32   // AES-256
const V2_PREFIX  = 'v2.'

function deriveKey(secret: string, salt: string): Buffer {
  return scryptSync(secret, Buffer.from(salt, 'utf8'), KEY_BYTES) as Buffer
}

let _v1Key: Buffer | null = null
function getV1Key(): Buffer {
  if (!_v1Key) {
    const secret = process.env.AUTH_SECRET
    if (!secret) throw new Error('AUTH_SECRET not set — cannot decrypt legacy (v1) secrets')
    _v1Key = deriveKey(secret, 'wealthwatcher-v1')
  }
  return _v1Key
}

let _v2Key: Buffer | null = null
function getV2Key(): Buffer {
  if (!_v2Key) {
    const secret = process.env.DATA_ENCRYPTION_KEY ?? process.env.AUTH_SECRET
    if (!secret) throw new Error('DATA_ENCRYPTION_KEY (o AUTH_SECRET) not set — cannot encrypt/decrypt secrets')
    _v2Key = deriveKey(secret, 'wealthwatcher-v2')
  }
  return _v2Key
}

function seal(key: Buffer, plain: string): string {
  const iv     = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ct     = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag    = cipher.getAuthTag()
  return [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join('.')
}

function unseal(key: Buffer, body: string): string {
  const parts = body.split('.')
  if (parts.length !== 3) throw new Error('Invalid encrypted secret format')
  const [ivB64, tagB64, ctB64] = parts
  const iv  = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const ct  = Buffer.from(ctB64, 'base64')
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('Invalid encrypted secret format')
  }
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  try {
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
  } catch {
    throw new Error('Decryption failed — data may have been tampered with')
  }
}

/** Cifra un segreto per la persistenza — sempre in formato v2 (corrente). */
export function encryptSecret(plain: string): string {
  return V2_PREFIX + seal(getV2Key(), plain)
}

/** Decifra un segreto — riconosce sia il formato v2 corrente sia il v1 legacy. */
export function decryptSecret(stored: string): string {
  if (stored.startsWith(V2_PREFIX)) {
    return unseal(getV2Key(), stored.slice(V2_PREFIX.length))
  }
  return unseal(getV1Key(), stored)
}
