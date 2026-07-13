// src/__tests__/lib/backupCrypto.test.ts
import { encryptBackupBuffer, decryptBackupBuffer } from '@/lib/backupCrypto'

test('round-trip: decifra esattamente ciò che è stato cifrato', () => {
  const plain = Buffer.from('contenuto finto di un database SQLite', 'utf8')
  const encrypted = encryptBackupBuffer(plain)
  expect(decryptBackupBuffer(encrypted)).toEqual(plain)
})

test('il ciphertext non contiene il testo in chiaro', () => {
  const plain = Buffer.from('SEGRETO-RICONOSCIBILE-12345', 'utf8')
  const encrypted = encryptBackupBuffer(plain)
  expect(encrypted.includes(plain)).toBe(false)
})

test('due cifrature dello stesso contenuto producono output diversi (IV random)', () => {
  const plain = Buffer.from('stesso contenuto', 'utf8')
  const a = encryptBackupBuffer(plain)
  const b = encryptBackupBuffer(plain)
  expect(a.equals(b)).toBe(false)
})

test('rifiuta un file manomesso (auth tag non valido)', () => {
  const plain = Buffer.from('dati integri', 'utf8')
  const encrypted = encryptBackupBuffer(plain)
  const tampered = Buffer.from(encrypted)
  tampered[tampered.length - 1] ^= 0xff // altera l'ultimo byte del ciphertext
  expect(() => decryptBackupBuffer(tampered)).toThrow()
})

test('rifiuta un buffer troppo corto per contenere IV+TAG', () => {
  expect(() => decryptBackupBuffer(Buffer.from('troppo corto'))).toThrow()
})
