// src/lib/api/requireApiUser.ts — Punto d'ingresso unico per le route M2M
// sotto /api/homepage/v1/*, pensate per il widget customapi di Homepage
// (gethomepage.dev). Analogo a requireUser() di src/lib/dal.ts, ma per
// accesso via token invece che via sessione browser.
//
// src/proxy.ts esclude /api/* dal matcher: queste route non hanno né gate
// cookie né CSP a monte, l'autenticazione sta tutta qui.
import type { NextRequest } from 'next/server'
import { verifyApiToken, touchApiToken } from '@/lib/apiTokens'
import { getSession } from '@/lib/dal'
import { checkRateLimit } from '@/lib/rateLimit'
import { jsonNoStore } from './respond'

const RATE_LIMIT       = 120       // richieste
const RATE_WINDOW_MS   = 60_000    // per finestra di 1 minuto, per utente

export type ApiAuth =
  | { ok: true; userId: number; via: 'token' | 'session' }
  | { ok: false; response: ReturnType<typeof jsonNoStore> }

function extractToken(req: NextRequest): string | null {
  const apiKeyHeader = req.headers.get('x-api-key')
  if (apiKeyHeader) return apiKeyHeader.trim()

  const authHeader = req.headers.get('authorization')
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim()
  }
  return null
}

function unauthorized(): ApiAuth {
  return {
    ok: false,
    response: jsonNoStore(
      { error: 'API key mancante o non valida' },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } },
    ),
  }
}

/**
 * Risolve l'utente per una richiesta verso /api/homepage/v1/*:
 *  1. header X-API-Key o Authorization: Bearer <token> → verifica token
 *  2. altrimenti fallback alla sessione NextAuth (comodo per aprire l'endpoint
 *     nel browser da loggati e validare i campi prima di configurare Homepage)
 *  3. altrimenti 401
 *
 * In caso di successo applica anche il rate limit per utente.
 */
export async function requireApiUser(req: NextRequest): Promise<ApiAuth> {
  const token = extractToken(req)

  let userId: number | null = null
  let via: 'token' | 'session' = 'session'

  if (token) {
    const identity = verifyApiToken(token)
    if (!identity) return unauthorized()
    touchApiToken(identity.tokenId)
    userId = identity.userId
    via = 'token'
  } else {
    const session = await getSession()
    if (session?.uid) {
      userId = session.uid
      via = 'session'
    }
  }

  if (userId === null) return unauthorized()

  const { allowed, retryAfterMs } = checkRateLimit(`homepage-api:${userId}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!allowed) {
    return {
      ok: false,
      response: jsonNoStore(
        { error: 'Troppe richieste, riprova più tardi' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } },
      ),
    }
  }

  return { ok: true, userId, via }
}
