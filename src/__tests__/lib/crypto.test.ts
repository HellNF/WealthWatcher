// crypto.ts tests — uses the real Node.js crypto (no mocking needed).
import { encryptSecret, decryptSecret } from '@/lib/crypto'

describe('encryptSecret / decryptSecret', () => {
  test('round-trip: decrypted value matches original', () => {
    const plain = 'sk-test-my-openai-key-1234'
    const stored = encryptSecret(plain)
    expect(decryptSecret(stored)).toBe(plain)
  })

  test('ciphertext is different from plaintext', () => {
    const plain = 'sk-secret'
    const stored = encryptSecret(plain)
    expect(stored).not.toContain(plain)
  })

  test('two encryptions of the same value produce different ciphertexts (random IV)', () => {
    const plain = 'same-key'
    expect(encryptSecret(plain)).not.toBe(encryptSecret(plain))
  })

  test('stored format has exactly three dot-separated segments', () => {
    const stored = encryptSecret('any-value')
    expect(stored.split('.').length).toBe(3)
  })

  test('tampered ciphertext throws on decryption', () => {
    const stored = encryptSecret('original')
    const parts = stored.split('.')
    // Corrupt the ciphertext segment
    parts[2] = Buffer.from('corrupted').toString('base64')
    expect(() => decryptSecret(parts.join('.'))).toThrow()
  })

  test('tampered tag throws on decryption', () => {
    const stored = encryptSecret('original')
    const parts = stored.split('.')
    // Corrupt the auth tag
    parts[1] = Buffer.from('00000000000000000000').toString('base64')
    expect(() => decryptSecret(parts.join('.'))).toThrow()
  })

  test('invalid format throws', () => {
    expect(() => decryptSecret('only-one-segment')).toThrow()
    expect(() => decryptSecret('a.b')).toThrow()
  })
})
