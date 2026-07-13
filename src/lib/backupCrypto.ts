// src/lib/backupCrypto.ts
//
// AES-256-GCM per i FILE di backup del database (binari, potenzialmente
// diversi MB). Diverso da src/lib/crypto.ts (che cifra piccoli segreti
// testuali in formato base64 "iv.tag.ciphertext"): qui il formato è binario
// grezzo — IV | TAG | CIPHERTEXT — per non gonfiare la dimensione del file
// con l'overhead del base64 su un intero DB.
//
// Chiave: BACKUP_ENCRYPTION_KEY se impostata, altrimenti deriva da
// AUTH_SECRET con un salt dedicato ('wealthwatcher-backup-v1', diverso da
// quello usato in crypto.ts) — così anche senza una chiave di backup dedicata
// il materiale crittografico non è letteralmente lo stesso usato per i
// segreti utente (isolamento minimo tra domini).
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALGORITHM  = 'aes-256-gcm'
const IV_BYTES   = 12
const TAG_BYTES  = 16
const KEY_BYTES  = 32
const SALT       = Buffer.from('wealthwatcher-backup-v1', 'utf8')

function deriveBackupKey(): Buffer {
  const secret = process.env.BACKUP_ENCRYPTION_KEY ?? process.env.AUTH_SECRET
  if (!secret) {
    throw new Error(
      'BACKUP_ENCRYPTION_KEY (o in fallback AUTH_SECRET) deve essere impostata per cifrare/decifrare i backup',
    )
  }
  return scryptSync(secret, SALT, KEY_BYTES) as Buffer
}

/** Cifra il contenuto grezzo di un file di backup. Ritorna IV|TAG|ciphertext. */
export function encryptBackupBuffer(plain: Buffer): Buffer {
  const key    = deriveBackupKey()
  const iv     = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ct     = Buffer.concat([cipher.update(plain), cipher.final()])
  const tag    = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct])
}

/** Decifra un buffer prodotto da encryptBackupBuffer. Lancia se manomesso o chiave errata. */
export function decryptBackupBuffer(encrypted: Buffer): Buffer {
  if (encrypted.length < IV_BYTES + TAG_BYTES) {
    throw new Error('File di backup cifrato non valido (troppo corto)')
  }
  const key        = deriveBackupKey()
  const iv         = encrypted.subarray(0, IV_BYTES)
  const tag        = encrypted.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ciphertext = encrypted.subarray(IV_BYTES + TAG_BYTES)
  const decipher   = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  } catch {
    throw new Error('Decifratura del backup fallita — file corrotto o chiave errata')
  }
}

export const BACKUP_ENCRYPTED_EXT = '.enc'
