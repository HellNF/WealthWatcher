// src/__tests__/lib/banking-jwt.test.ts — Firma JWT RS256 per Enable Banking.
// Genera una coppia di chiavi RSA di test e verifica che il token prodotto
// abbia i claims attesi e una firma valida rispetto alla chiave pubblica
// (cfr. memoria: testare l'integrazione vera, non solo assumerne la forma).
// Le credenziali sono per-utente (piano gratuito Enable Banking = un'app per
// account) e passate esplicitamente, non lette da env globali.
import { createVerify, generateKeyPairSync } from 'crypto'
import { getEnableBankingJwt, _resetJwtCacheForTests } from '@/lib/banking/jwt'
import type { EnableBankingCredentials } from '@/lib/banking/types'

describe('Enable Banking JWT signing', () => {
  let creds: EnableBankingCredentials
  let publicKeyPem: string

  beforeAll(() => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding:  { type: 'spki',  format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })
    publicKeyPem = publicKey
    creds = { appId: 'test-app-id', privateKey }
  })

  beforeEach(() => {
    _resetJwtCacheForTests()
  })

  test('genera un JWT RS256 con header/claims attesi e firma verificabile', () => {
    const token = getEnableBankingJwt(creds)
    const [headerB64, payloadB64, sigB64] = token.split('.')
    expect(headerB64).toBeTruthy()
    expect(payloadB64).toBeTruthy()
    expect(sigB64).toBeTruthy()

    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'))
    expect(header).toEqual({ typ: 'JWT', alg: 'RS256', kid: 'test-app-id' })

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
    expect(payload.iss).toBe('enablebanking.com')
    expect(payload.aud).toBe('api.enablebanking.com')
    expect(payload.exp - payload.iat).toBe(3600)

    const verifier = createVerify('RSA-SHA256')
    verifier.update(`${headerB64}.${payloadB64}`)
    verifier.end()
    expect(verifier.verify(publicKeyPem, Buffer.from(sigB64, 'base64url'))).toBe(true)
  })

  test('riusa il token cachato per lo stesso app_id entro la finestra di validità', () => {
    const t1 = getEnableBankingJwt(creds)
    const t2 = getEnableBankingJwt(creds)
    expect(t1).toBe(t2)
  })

  test('app_id diversi ottengono token con kid diversi (nessuna cross-contaminazione)', () => {
    const { privateKey: otherKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding:  { type: 'spki',  format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })
    const otherCreds: EnableBankingCredentials = { appId: 'other-app-id', privateKey: otherKey }

    const token1 = getEnableBankingJwt(creds)
    const token2 = getEnableBankingJwt(otherCreds)
    expect(token1).not.toBe(token2)

    const header2 = JSON.parse(Buffer.from(token2.split('.')[0], 'base64url').toString('utf8'))
    expect(header2.kid).toBe('other-app-id')
  })
})
