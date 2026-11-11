// src/lib/banking/syncRuns.ts — Esito delle sincronizzazioni Open Banking.
//
// Ogni sync (pulsante in app o script programmato) passa da runConnectionSync,
// che registra l'esito in sync_runs anche quando la sync va in eccezione: un
// errore notturno resta visibile in app invece di finire solo nei log.
// Nessun dato bancario: solo conteggi e messaggi d'errore generici.
import { sqlite } from '@/db'
import { formatDateTimeIt } from '@/lib/formatDate'
import type { EbConnection, SyncRun } from '@/db/schema'
import { syncConnection, type ConnectionSyncResult } from './sync'

export type SyncTrigger = 'manual' | 'scheduled'
export type SyncOutcome = SyncRun['outcome']

export interface SyncRunAccount {
  accountId:  number
  inserted:   number
  duplicates: number
  error?:     string
}

export interface SyncRunView {
  id:             number
  connectionId:   number
  trigger:        SyncTrigger
  outcome:        SyncOutcome
  startedAt:      number
  finishedAt:     number
  insertedCount:  number
  duplicateCount: number
  error:          string | null
  accounts:       SyncRunAccount[]
}

const KEEP_PER_CONNECTION = 30
const UNEXPECTED_ERROR = 'Errore imprevisto durante la sincronizzazione.'

export function outcomeOf(result: ConnectionSyncResult): SyncOutcome {
  if (result.status === 'expired') return 'expired'
  if (result.status === 'no-credentials') return 'no-credentials'
  const failed = result.accounts.filter((a) => a.error).length
  if (failed === 0) return 'ok'
  return failed === result.accounts.length ? 'failed' : 'partial'
}

function errorOf(result: ConnectionSyncResult): string | null {
  if (result.status === 'expired') return 'Consenso scaduto o revocato: ricollega la banca.'
  if (result.status === 'no-credentials') return 'Chiave Enable Banking mancante: reimpostala nelle impostazioni.'
  const errors = [...new Set(result.accounts.map((a) => a.error).filter((e): e is string => !!e))]
  return errors.length ? errors.join(' · ') : null
}

function recordSyncRun(
  connection: Pick<EbConnection, 'id' | 'owner_id'>,
  trigger: SyncTrigger,
  startedAt: number,
  outcome: SyncOutcome,
  details: { accounts?: SyncRunAccount[]; error?: string | null } = {},
): void {
  const accounts = details.accounts ?? []
  sqlite.transaction(() => {
    sqlite.prepare(
      `INSERT INTO sync_runs (owner_id, connection_id, trigger, outcome, started_at, finished_at,
         inserted_count, duplicate_count, error, accounts_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      connection.owner_id, connection.id, trigger, outcome, startedAt, Math.floor(Date.now() / 1000),
      accounts.reduce((s, a) => s + a.inserted, 0), accounts.reduce((s, a) => s + a.duplicates, 0),
      details.error ?? null, JSON.stringify(accounts),
    )
    sqlite.prepare(
      `DELETE FROM sync_runs WHERE connection_id = ? AND id NOT IN (
         SELECT id FROM sync_runs WHERE connection_id = ? ORDER BY started_at DESC, id DESC LIMIT ?)`,
    ).run(connection.id, connection.id, KEEP_PER_CONNECTION)
  })()
}

/** Sincronizza la connessione e ne registra sempre l'esito. Rilancia le eccezioni dopo averle registrate. */
export async function runConnectionSync(connection: EbConnection, trigger: SyncTrigger): Promise<ConnectionSyncResult> {
  const startedAt = Math.floor(Date.now() / 1000)
  let result: ConnectionSyncResult
  try {
    result = await syncConnection(connection)
  } catch (err) {
    recordSyncRun(connection, trigger, startedAt, 'failed', { error: UNEXPECTED_ERROR })
    throw err
  }
  recordSyncRun(connection, trigger, startedAt, outcomeOf(result), {
    error: errorOf(result),
    accounts: result.accounts.map((a) => ({
      accountId: a.accountId, inserted: a.insertedCount, duplicates: a.duplicateCount,
      ...(a.error ? { error: a.error } : {}),
    })),
  })
  return result
}

function toView(row: SyncRun): SyncRunView {
  let accounts: SyncRunAccount[] = []
  try { accounts = JSON.parse(row.accounts_json) } catch { /* riga malformata: nessun dettaglio */ }
  return {
    id: row.id, connectionId: row.connection_id, trigger: row.trigger, outcome: row.outcome,
    startedAt: row.started_at, finishedAt: row.finished_at, insertedCount: row.inserted_count,
    duplicateCount: row.duplicate_count, error: row.error, accounts,
  }
}

/** Ultime esecuzioni di una connessione dell'utente, più recenti prima. */
export function listSyncRuns(userId: number, connectionId: number, limit = 10): SyncRunView[] {
  return (sqlite.prepare(
    `SELECT * FROM sync_runs WHERE owner_id = ? AND connection_id = ?
     ORDER BY started_at DESC, id DESC LIMIT ?`,
  ).all(userId, connectionId, limit) as SyncRun[]).map(toView)
}

/** Ultima esecuzione della connessione, o null se non è mai stata sincronizzata da quando esiste lo storico. */
export function latestSyncRun(userId: number, connectionId: number): SyncRunView | null {
  return listSyncRuns(userId, connectionId, 1)[0] ?? null
}

const OUTCOME_LABEL: Record<SyncOutcome, string> = {
  'ok':             'riuscita',
  'partial':        'riuscita in parte',
  'failed':         'non riuscita',
  'expired':        'consenso scaduto',
  'no-credentials': 'chiave mancante',
}

/** Riga già formattata per l'interfaccia (serializzabile verso i client component). */
export interface SyncRunSummary {
  id:      number
  when:    string
  trigger: string
  outcome: SyncOutcome
  label:   string
  detail:  string
  error:   string | null
}

export function summarizeSyncRun(run: SyncRunView, accountNames: Map<number, string> = new Map()): SyncRunSummary {
  const failedAccounts = run.accounts.filter((a) => a.error).map((a) => accountNames.get(a.accountId) ?? `conto #${a.accountId}`)
  const counts = run.outcome === 'ok' || run.outcome === 'partial'
    ? `${run.insertedCount} ${run.insertedCount === 1 ? 'nuovo movimento' : 'nuovi movimenti'}`
    : ''
  return {
    id:      run.id,
    when:    formatDateTimeIt(run.startedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    trigger: run.trigger === 'manual' ? 'manuale' : 'programmata',
    outcome: run.outcome,
    label:   OUTCOME_LABEL[run.outcome],
    detail:  [counts, failedAccounts.length ? `errori su: ${failedAccounts.join(', ')}` : ''].filter(Boolean).join(' · '),
    error:   run.error,
  }
}
