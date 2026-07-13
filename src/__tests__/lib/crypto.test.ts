// crypto.ts tests — uses the real Node.js crypto (no mocking needed).
// jest.resetModules() + require() dinamico: crypto.ts memorizza la chiave
// derivata a livello di modulo (calcolata una sola volta), quindi i test che
// cambiano DATA_ENCRYPTION_KEY o vogliono un'istanza "pulita" del modulo
// devono ricaricarlo esplicitamente.
import { createCipheriv, randomBytes, scryptSync } from 'crypto'

describe('encryptSecret / decryptSecret (v2, formato corrente)', () => {
  let encryptSecret: typeof import('@/lib/crypto').encryptSecret
  let decryptSecret: typeof import('@/lib/crypto').decryptSecret

  beforeEach(() => {
    jest.resetModules()
    ;({ encryptSecret, decryptSecret } = require('@/lib/crypto'))
  })

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

  test('le nuove cifrature sono in formato v2', () => {
    const stored = encryptSecret('any-value')
    expect(stored.startsWith('v2.')).toBe(true)
    expect(stored.slice('v2.'.length).split('.')).toHaveLength(3)
  })

  test('tampered ciphertext throws on decryption', () => {
    const stored = encryptSecret('original')
    const [prefix, iv, tag] = stored.split('.')
    const tampered = [prefix, iv, tag, Buffer.from('corrupted').toString('base64')].join('.')
    expect(() => decryptSecret(tampered)).toThrow()
  })

  test('tampered tag throws on decryption', () => {
    const stored = encryptSecret('original')
    const parts = stored.split('.')
    parts[2] = Buffer.from('00000000000000000000').toString('base64') // segmento del tag
    expect(() => decryptSecret(parts.join('.'))).toThrow()
  })

  test('invalid format throws', () => {
    expect(() => decryptSecret('only-one-segment')).toThrow()
    expect(() => decryptSecret('a.b')).toThrow()
    expect(() => decryptSecret('v2.a.b')).toThrow()
  })
})

describe('retrocompatibilità v1 (legacy)', () => {
  function encryptV1(plain: string, authSecret: string): string {
    const key    = scryptSync(authSecret, Buffer.from('wealthwatcher-v1', 'utf8'), 32)
    const iv     = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const ct     = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
    const tag    = cipher.getAuthTag()
    return [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join('.')
  }

  test('decryptSecret legge ancora un ciphertext v1 prodotto con AUTH_SECRET', () => {
    jest.resetModules()
    const { decryptSecret } = require('@/lib/crypto')
    const stored = encryptV1('legacy-secret', process.env.AUTH_SECRET!)
    expect(decryptSecret(stored)).toBe('legacy-secret')
  })

  test('un ciphertext v1 e uno v2 dello stesso valore sono diversi (salt diverso)', () => {
    jest.resetModules()
    const { encryptSecret } = require('@/lib/crypto')
    const v1 = encryptV1('stesso-valore', process.env.AUTH_SECRET!)
    const v2 = encryptSecret('stesso-valore')
    expect(v2.startsWith('v2.')).toBe(true)
    expect(v2.slice('v2.'.length)).not.toBe(v1)
  })
})

describe('DATA_ENCRYPTION_KEY dedicata', () => {
  const ORIGINAL = process.env.DATA_ENCRYPTION_KEY

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.DATA_ENCRYPTION_KEY
    else process.env.DATA_ENCRYPTION_KEY = ORIGINAL
  })

  test('se impostata, le nuove cifrature v2 la usano al posto di AUTH_SECRET', () => {
    process.env.DATA_ENCRYPTION_KEY = 'chiave-dedicata-per-i-dati-a-riposo'
    jest.resetModules()
    const { encryptSecret, decryptSecret } = require('@/lib/crypto')

    const stored = encryptSecret('valore-protetto')
    expect(decryptSecret(stored)).toBe('valore-protetto')
  })

  test('con una DATA_ENCRYPTION_KEY diversa, un vecchio ciphertext v2 non decifra più', () => {
    process.env.DATA_ENCRYPTION_KEY = 'chiave-A'
    jest.resetModules()
    const { encryptSecret: encryptWithA } = require('@/lib/crypto')
    const stored = encryptWithA('valore')

    process.env.DATA_ENCRYPTION_KEY = 'chiave-B-completamente-diversa'
    jest.resetModules()
    const { decryptSecret: decryptWithB } = require('@/lib/crypto')
    expect(() => decryptWithB(stored)).toThrow()
  })
})
