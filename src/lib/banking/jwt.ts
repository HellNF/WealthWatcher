// src/lib/banking/jwt.ts — Firma i JWT RS256 richiesti da ogni chiamata
// all'API Enable Banking (Open Banking AISP). Nessuna dipendenza esterna:
// si usa node:crypto per firmare header+payload con la chiave privata
// dell'app registrata dall'utente nel Control Panel Enable Banking.
//
// Il piano gratuito di Enable Banking è per-account (un'app registrata a
// testa): le credenziali NON sono globali all'istanza ma per-utente, lette
// da src/lib/userSettings.ts (getEnableBankingKey) e passate esplicitamente
// a ogni funzione di questo modulo e di client.ts.
//
// Claims fissi: iss/aud = 'enablebanking.com'/'api.enablebanking.com',
// iat, exp (1h, sotto il limite massimo di 24h imposto dall'API).
import { createSign } from 'crypto'
import type { EnableBankingCredentials } from './types'

export type { EnableBankingCredentials }

const ISS = 'enablebanking.com'
const AUD = 'api.enablebanking.com'
const TTL_SECONDS = 3600
const REFRESH_MARGIN_SECONDS = 60 // rigenera un minuto prima della scadenza effettiva

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buf.toString('base64url')
}

// Cache in-process per app_id, condivisa fra gli utenti eseguiti nello stesso
// processo (es. script di sync schedulato che itera più connessioni).
const cache = new Map<string, { token: string; exp: number }>()

/** Restituisce un JWT valido per l'header Authorization, riusando la cache finché non è prossima a scadenza. */
export function getEnableBankingJwt(creds: EnableBankingCredentials): string {
  const now = Math.floor(Date.now() / 1000)
  const cached = cache.get(creds.appId)
  if (cached && cached.exp - now > REFRESH_MARGIN_SECONDS) return cached.token

  const iat = now
  const exp = iat + TTL_SECONDS

  const header  = { typ: 'JWT', alg: 'RS256', kid: creds.appId }
  const payload = { iss: ISS, aud: AUD, iat, exp }

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`
  const signature     = createSign('RSA-SHA256').update(signingInput).sign(creds.privateKey)
  const token          = `${signingInput}.${base64url(signature)}`

  cache.set(creds.appId, { token, exp })
  return token
}

/** Solo per i test: azzera la cache dei token così ogni test riparte pulito. */
export function _resetJwtCacheForTests(): void {
  cache.clear()
}
