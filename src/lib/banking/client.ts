// src/lib/banking/client.ts — Client HTTP per l'API Enable Banking (Open
// Banking AISP). Fetch nativa, nessuna dipendenza HTTP esterna, stesso
// pattern dei provider prezzi (src/lib/prices/*): ritorna null su errore e
// logga con console.warn invece di propagare l'eccezione, così un fallimento
// dell'aggregatore non abbatte l'intera richiesta che lo invoca.
//
// Ogni funzione accetta le credenziali dell'app come primo parametro (piano
// gratuito Enable Banking = un'app per account utente, non un'app globale
// dell'istanza — vedi src/lib/userSettings.ts).
import { getEnableBankingJwt } from './jwt'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'
import type {
  Aspsp, AspspsResponse, AuthResponse, EbAccount, EnableBankingCredentials, Session,
  BalancesResponse, EbBalance, EbTransaction, TransactionsResponse,
} from './types'

const BASE = process.env.ENABLE_BANKING_BASE_URL ?? 'https://api.enablebanking.com'

function authHeaders(creds: EnableBankingCredentials): HeadersInit {
  return {
    'Authorization': `Bearer ${getEnableBankingJwt(creds)}`,
    'Content-Type':  'application/json',
    'Accept':        'application/json',
  }
}

// NB: non logghiamo mai il body delle risposte (né in caso di errore): può
// contenere saldi/transazioni/PII del conto bancario dell'utente. Solo
// status + path, sufficienti per il debug operativo senza finire nei log
// dati finanziari altrui.
async function get<T>(creds: EnableBankingCredentials, path: string): Promise<T | null> {
  try {
    const res = await fetchWithTimeout(`${BASE}${path}`, { headers: authHeaders(creds), cache: 'no-store' })
    if (!res.ok) {
      console.warn(`[enablebanking] GET ${path} → ${res.status}`)
      return null
    }
    return (await res.json()) as T
  } catch (err) {
    console.warn(`[enablebanking] GET ${path} failed:`, err instanceof Error ? err.message : 'errore sconosciuto')
    return null
  }
}

async function post<T>(creds: EnableBankingCredentials, path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetchWithTimeout(`${BASE}${path}`, {
      method:  'POST',
      headers: authHeaders(creds),
      body:    JSON.stringify(body),
      cache:   'no-store',
    })
    if (!res.ok) {
      console.warn(`[enablebanking] POST ${path} → ${res.status}`)
      return null
    }
    return (await res.json()) as T
  } catch (err) {
    console.warn(`[enablebanking] POST ${path} failed:`, err instanceof Error ? err.message : 'errore sconosciuto')
    return null
  }
}

async function del(creds: EnableBankingCredentials, path: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${BASE}${path}`, { method: 'DELETE', headers: authHeaders(creds), cache: 'no-store' })
    if (!res.ok) {
      console.warn(`[enablebanking] DELETE ${path} → ${res.status}`)
      return false
    }
    return true
  } catch (err) {
    console.warn(`[enablebanking] DELETE ${path} failed:`, err instanceof Error ? err.message : 'errore sconosciuto')
    return false
  }
}

/** Elenco ASPSP (banche) disponibili, opzionalmente filtrate per paese ISO2. */
export async function getAspsps(creds: EnableBankingCredentials, country?: string): Promise<Aspsp[] | null> {
  const qs = country ? `?country=${encodeURIComponent(country)}` : ''
  const res = await get<AspspsResponse>(creds, `/aspsps${qs}`)
  return res?.aspsps ?? null
}

export interface StartAuthParams {
  aspspName:    string
  aspspCountry: string
  state:        string
  redirectUrl:  string
  validUntil:   string   // ISO 8601 timestamp — scadenza del consenso
}

/** Avvia il consenso PSU: ritorna l'URL della banca a cui reindirizzare l'utente. */
export async function startAuth(
  creds:  EnableBankingCredentials,
  params: StartAuthParams,
): Promise<AuthResponse | null> {
  return post<AuthResponse>(creds, '/auth', {
    access:       { valid_until: params.validUntil },
    aspsp:        { name: params.aspspName, country: params.aspspCountry },
    state:        params.state,
    redirect_url: params.redirectUrl,
    psu_type:     'personal',
  })
}

/** Scambia il `code` ricevuto sul redirect_url con una sessione + conti autorizzati. */
export async function createSession(creds: EnableBankingCredentials, code: string): Promise<Session | null> {
  return post<Session>(creds, '/sessions', { code })
}

/** Revoca la sessione lato Enable Banking (disconnessione esplicita). */
export async function deleteSession(creds: EnableBankingCredentials, sessionId: string): Promise<boolean> {
  return del(creds, `/sessions/${encodeURIComponent(sessionId)}`)
}

// Codici di ErrorResponse.error che indicano una sessione non più utilizzabile.
const DEAD_SESSION_ERRORS = new Set([
  'EXPIRED_SESSION', 'REVOKED_SESSION', 'CLOSED_SESSION', 'SESSION_DOES_NOT_EXIST',
])
// SessionStatus terminali: serve un nuovo consenso dell'utente.
const DEAD_SESSION_STATUSES = new Set(['EXPIRED', 'REVOKED', 'CANCELLED', 'CLOSED', 'INVALID'])

export type SessionCheck =
  | { kind: 'alive'; validUntil: number | null }
  | { kind: 'dead'; reason: string }
  // Errore di rete, rate limit, chiave applicativa errata (401) ecc.: non dice
  // nulla sullo stato del consenso, quindi la sync prosegue come prima.
  | { kind: 'unknown' }

/**
 * Stato della sessione presso Enable Banking (GET /sessions/{id}). È l'unico
 * modo documentato per accorgersi di un consenso revocato o chiuso prima
 * della data di scadenza salvata in locale. Un errore su un singolo conto
 * non basta a considerare morta l'intera connessione.
 */
export async function checkSession(creds: EnableBankingCredentials, sessionId: string): Promise<SessionCheck> {
  const path = `/sessions/${encodeURIComponent(sessionId)}`
  try {
    const res = await fetchWithTimeout(`${BASE}${path}`, { headers: authHeaders(creds), cache: 'no-store' })
    if (!res.ok) {
      console.warn(`[enablebanking] GET /sessions/… → ${res.status}`)
      const body = await res.json().catch(() => null) as { error?: unknown } | null
      const code = typeof body?.error === 'string' ? body.error : null
      if (code && DEAD_SESSION_ERRORS.has(code)) return { kind: 'dead', reason: code }
      if (res.status === 404) return { kind: 'dead', reason: 'SESSION_DOES_NOT_EXIST' }
      return { kind: 'unknown' }
    }
    const data = await res.json() as { status?: unknown; access?: { valid_until?: unknown } }
    const status = typeof data.status === 'string' ? data.status : null
    if (status && DEAD_SESSION_STATUSES.has(status)) return { kind: 'dead', reason: status }
    if (status !== 'AUTHORIZED') return { kind: 'unknown' }
    const parsed = typeof data.access?.valid_until === 'string' ? Date.parse(data.access.valid_until) : NaN
    return { kind: 'alive', validUntil: Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null }
  } catch (err) {
    console.warn(`[enablebanking] GET /sessions/… failed:`, err instanceof Error ? err.message : 'errore sconosciuto')
    return { kind: 'unknown' }
  }
}

/** Dettagli del conto (stessa forma degli account di Session), incluso `identification_hash`. */
export async function getAccountDetails(
  creds:      EnableBankingCredentials,
  accountUid: string,
): Promise<EbAccount | null> {
  return get<EbAccount>(creds, `/accounts/${encodeURIComponent(accountUid)}/details`)
}

export async function getBalances(
  creds:      EnableBankingCredentials,
  accountUid: string,
): Promise<EbBalance[] | null> {
  const res = await get<BalancesResponse>(creds, `/accounts/${encodeURIComponent(accountUid)}/balances`)
  return res?.balances ?? null
}

// Limite di sicurezza sul numero di pagine seguite per una singola sync, per
// non restare bloccati all'infinito se l'API restituisse continuation_key
// sempre diverse in modo anomalo.
const MAX_TRANSACTION_PAGES = 50

/**
 * Tutte le transazioni del conto, seguendo la paginazione via continuation_key.
 * `dateFrom` (ISO YYYY-MM-DD) limita la finestra temporale quando fornita.
 */
export async function getTransactions(
  creds:      EnableBankingCredentials,
  accountUid: string,
  dateFrom?:  string,
): Promise<EbTransaction[] | null> {
  const all: EbTransaction[] = []
  let continuationKey: string | undefined
  let page = 0
  const seenKeys = new Set<string>()

  do {
    const params = new URLSearchParams({ transaction_status: 'BOOK' })
    if (dateFrom) params.set('date_from', dateFrom)
    if (continuationKey) params.set('continuation_key', continuationKey)
    const qs = params.toString() ? `?${params.toString()}` : ''

    const res = await get<TransactionsResponse>(
      creds,
      `/accounts/${encodeURIComponent(accountUid)}/transactions${qs}`,
    )
    if (!res || !Array.isArray(res.transactions)) return null

    all.push(...res.transactions)
    continuationKey = res.continuation_key
    if (continuationKey) {
      if (seenKeys.has(continuationKey)) return null
      seenKeys.add(continuationKey)
    }
    page++
  } while (continuationKey && page < MAX_TRANSACTION_PAGES)

  // Never treat a truncated history as a successful sync.
  return continuationKey ? null : all
}
