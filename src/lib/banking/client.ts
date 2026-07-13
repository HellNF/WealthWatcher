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
  Aspsp, AspspsResponse, AuthResponse, EnableBankingCredentials, Session,
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

  do {
    const params = new URLSearchParams()
    if (dateFrom) params.set('date_from', dateFrom)
    if (continuationKey) params.set('continuation_key', continuationKey)
    const qs = params.toString() ? `?${params.toString()}` : ''

    const res = await get<TransactionsResponse>(
      creds,
      `/accounts/${encodeURIComponent(accountUid)}/transactions${qs}`,
    )
    if (!res) return page === 0 ? null : all // prima pagina fallita → errore; pagine successive → best-effort

    all.push(...res.transactions)
    continuationKey = res.continuation_key
    page++
  } while (continuationKey && page < MAX_TRANSACTION_PAGES)

  return all
}
