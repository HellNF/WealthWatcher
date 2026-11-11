// src/lib/banking/sync.ts — Orchestrazione della sincronizzazione: per ogni
// bank_account collegato a una bank_connection Enable Banking, scarica saldo
// e movimenti e li scrive con l'infrastruttura di import esistente
// (src/lib/transactions.ts). Chiamata sia dalla server action manuale
// (bottone "Sincronizza") sia dallo script schedulato (scripts/bank-sync.ts).
//
// Nota autenticazione: gli endpoint /accounts/{uid}/balances e /transactions
// richiedono solo il JWT applicativo (Authorization: Bearer) — l'uid del
// conto identifica implicitamente il consenso che lo autorizza. Il
// session_id serve solo per gestire la sessione stessa (revoca), non per
// leggere saldi/movimenti.
import { createHash } from 'crypto'
import { dec, toMinor } from '@/lib/money'
import {
  normalizeDescription, resolveCategoryRule, resolveMerchant,
  resolveMccCategory, resolveBankTransactionCategory,
} from '@/lib/merchants'
import { insertBatch, type InsertableTransaction } from '@/lib/transactions'
import { setAccountBalanceAnchor } from '@/lib/accounts'
import { fillLearnedCategories } from '@/lib/learnedCategories'
import { getEnableBankingKey } from '@/lib/userSettings'
import type { BankAccount, EbConnection } from '@/db/schema'
import { sqlite } from '@/db'
import { autoMergeRenewalDuplicates, type RenewalMerge } from '@/lib/accountMerge'
import { checkSession, getAccountDetails, getBalances, getTransactions } from './client'
import type { EbBalance, EbTransaction, EnableBankingCredentials } from './types'
import {
  decryptSessionId, ebAccountKey, listAccountsForConnection, markConnectionSynced, setAccountKey,
  setConnectionStatus, setConnectionValidUntil,
} from './connections'

// ── Mapping EbTransaction → InsertableTransaction ─────────────────────────

// Ordine di preferenza dei tipi di saldo Berlin Group/NextGenPSD2: il saldo
// contabile chiuso è il più "autorevole"; a scendere via via meno definitivo.
// I saldi disponibili vengono dopo quelli contabili perché alcune banche vi
// includono il fido accordato, gonfiando la liquidità.
const BALANCE_TYPE_PRIORITY = [
  'CLBD', 'closingBooked', 'ITBD', 'interimBooked',
  'CLAV', 'closingAvailable', 'ITAV', 'interimAvailable',
  'XPCD', 'expected', 'PRCD', 'previouslyClosedBooked', 'OPBD', 'openingBooked',
]
// Mai usati come saldo del conto, nemmeno come ultimo ripiego: futuri
// (FWAV) o puramente informativi (INFO, OTHR).
const NEVER_BALANCE_TYPES = new Set(['FWAV', 'forwardAvailable', 'INFO', 'information', 'OTHR', 'other'])

const DECIMAL_AMOUNT = /^-?\d+(\.\d+)?$/

/**
 * Sceglie il saldo da usare come riferimento del conto. Con `accountCurrency`
 * considera solo i saldi in quella valuta (i conti multivaluta riportano un
 * saldo per valuta sotto lo stesso tipo) e restituisce null se non ce n'è
 * nessuno: un saldo in un'altra valuta salvato come riferimento sarebbe
 * sbagliato. Importi non numerici vengono scartati invece di far fallire la sync.
 */
export function pickBalance(balances: EbBalance[], accountCurrency?: string): EbBalance | null {
  const usable = balances.filter((b) =>
    DECIMAL_AMOUNT.test(b.balance_amount?.amount?.trim() ?? '')
    && /^[A-Z]{3}$/.test(b.balance_amount?.currency ?? '')
    && !NEVER_BALANCE_TYPES.has(b.balance_type)
    && (!accountCurrency || b.balance_amount.currency === accountCurrency))
  for (const type of BALANCE_TYPE_PRIORITY) {
    const found = usable.find((b) => b.balance_type === type)
    if (found) return found
  }
  return usable[0] ?? null
}

/**
 * Converte le transazioni EB in InsertableTransaction, con lo stesso schema
 * di dedup dei parser manuali (src/lib/import/intesa.ts): se l'ASPSP fornisce
 * un riferimento stabile (`entry_reference`) lo si usa come
 * base dell'hash. transaction_id può cambiare tra richieste: altrimenti si cade sui
 * campi grezzi + indice di occorrenza in-batch per preservare i duplicati
 * legittimi (es. due spese identiche nello stesso giorno).
 */
export function mapTransactions(
  ownerId:       number,
  bankAccountId: number,
  rows:          EbTransaction[],
): InsertableTransaction[] {
  const occurrences: Record<string, number> = {}
  const mapped: InsertableTransaction[] = []

  for (const t of rows) {
    // Pending/held entries can change amount or disappear before booking.
    if (t.status && t.status !== 'BOOK') continue
    const bookedDate = t.booking_date ?? t.value_date
    if (!bookedDate) {
      // Niente entry_reference/transaction_id nel log: sono identificativi
      // bancari (PII lieve) dell'utente proprietario del conto.
      console.warn('[enablebanking] transazione senza data, saltata')
      continue
    }

    const currency  = t.transaction_amount.currency
    const absMinor  = toMinor(dec(t.transaction_amount.amount).abs().toString(), currency)
    const sign      = t.credit_debit_indicator === 'DBIT' ? -1 : 1
    const amountMinor = sign * absMinor

    // The other party depends on the flow; the creditor of a credit is us.
    const counterpartyRaw = (t.credit_debit_indicator === 'DBIT'
      ? t.creditor?.name : t.debtor?.name)?.trim() || ''
    const descriptionRaw = t.remittance_information?.join(' ').trim()
      || counterpartyRaw || 'Movimento'

    const normalized = normalizeDescription(`${descriptionRaw} ${counterpartyRaw}`)
    const merchant    = resolveMerchant(normalized)
    // Priorità: regola utente → alias merchant → MCC (transazioni carta) →
    // bank_transaction_code (transazioni senza carta, dove l'MCC non arriva mai).
    const ruleCategory = resolveCategoryRule(normalized, ownerId, absMinor, { bankAccountId, amountMinor })
    const categoryId  = ruleCategory
      ?? merchant?.categoryId
      ?? resolveMccCategory(t.merchant_category_code)
      ?? resolveBankTransactionCategory(t.bank_transaction_code?.code, t.bank_transaction_code?.sub_code)
      ?? null

    const externalId = t.entry_reference ?? t.transaction_id ?? null
    const legacyDedupHash = t.transaction_id ? createHash('sha256').update(`eb:${t.transaction_id}`).digest('hex') : undefined
    let dedupHash: string
    if (t.entry_reference) {
      dedupHash = createHash('sha256').update(`eb:${t.entry_reference}`).digest('hex')
    } else {
      const rawKey   = `${bookedDate}|${amountMinor}|${currency}|${descriptionRaw}`
      const baseHash = createHash('sha256').update(rawKey).digest('hex')
      const occ      = occurrences[baseHash] ?? 0
      occurrences[baseHash] = occ + 1
      dedupHash = occ === 0 ? baseHash : createHash('sha256').update(`${rawKey}|${occ}`).digest('hex')
    }

    mapped.push({
      owner_id:         ownerId,
      bank_account_id:  bankAccountId,
      booked_date:      bookedDate,
      value_date:       t.value_date ?? null,
      amount_minor:     amountMinor,
      currency,
      description_raw:  descriptionRaw,
      counterparty_raw: counterpartyRaw || null,
      external_id:      externalId,
      dedup_hash:       dedupHash,
      legacy_dedup_hash: legacyDedupHash,
      merchant_id:      merchant?.merchantId ?? null,
      category_id:      categoryId,
      category_source:  ruleCategory !== null ? 'rule' : 'automatic',
      // Persistiamo MCC e bank_transaction_code grezzi (oltre alla categoria
      // derivata) così la ricategorizzazione bulk può riapplicarli senza
      // ri-sincronizzare.
      mcc:              t.merchant_category_code?.trim() || null,
      btc_sub_code:     t.bank_transaction_code?.sub_code?.trim() || null,
    })
  }

  return mapped
}

// ── Diagnostica post-mapping ────────────────────────────────────────────────

export interface MappingDiagnostics {
  total:         number
  withMcc:       number
  categorized:   number
  uncategorized: number
  unmappedMccs:  string[]   // codici MCC arrivati ma non presenti in MCC_CATEGORY_MAP
}

/**
 * Riassume l'esito della catena di categorizzazione su un batch già mappato,
 * per dare all'utente un riscontro numerico dopo il sync invece di doverlo
 * dedurre. Nota: opera sulle righe mappate, che includono i duplicati poi
 * scartati da insertBatch (INSERT OR IGNORE) — con SYNC_OVERLAP_DAYS i numeri
 * sono quindi leggermente superiori ai movimenti realmente nuovi.
 */
export function summarizeMapping(rows: InsertableTransaction[]): MappingDiagnostics {
  const unmapped = new Set<string>()
  let withMcc = 0
  let categorized = 0

  for (const row of rows) {
    if (row.mcc) {
      withMcc++
      if (resolveMccCategory(row.mcc) === null) unmapped.add(row.mcc)
    }
    if (row.category_id !== null && row.category_id !== undefined) categorized++
  }

  return {
    total:         rows.length,
    withMcc,
    categorized,
    uncategorized: rows.length - categorized,
    unmappedMccs:  [...unmapped],
  }
}

// ── Sync di un conto ───────────────────────────────────────────────────────

export interface AccountSyncResult {
  accountId:      number
  insertedCount:  number
  duplicateCount: number
  balanceUpdated: boolean
  diagnostics?:   MappingDiagnostics
  error?:         string
}

async function syncAccount(
  creds:    EnableBankingCredentials,
  ownerId:  number,
  account:  BankAccount,
  dateFrom: string | undefined,
): Promise<AccountSyncResult> {
  const uid = account.eb_account_uid
  if (!uid) {
    return { accountId: account.id, insertedCount: 0, duplicateCount: 0, balanceUpdated: false, error: 'Conto senza uid Enable Banking' }
  }

  // Conti collegati prima che salvassimo la chiave stabile: la recuperiamo ora,
  // così al prossimo rinnovo del consenso il conto verrà ricollegato e non duplicato.
  if (!account.eb_account_key) {
    const details = await getAccountDetails(creds, uid)
    const key = details ? ebAccountKey(details) : null
    if (key) setAccountKey(account.id, key)
  }

  let balanceUpdated = false
  const balances = await getBalances(creds, uid)
  if (balances && balances.length > 0) {
    const chosen = pickBalance(balances, account.currency)
    if (chosen) {
      const minor = toMinor(chosen.balance_amount.amount.trim(), chosen.balance_amount.currency)
      const date  = chosen.reference_date ?? new Date().toISOString().slice(0, 10)
      setAccountBalanceAnchor(ownerId, account.id, minor, date)
      balanceUpdated = true
    }
  }

  const transactions = await getTransactions(creds, uid, dateFrom)
  if (transactions === null) {
    return { accountId: account.id, insertedCount: 0, duplicateCount: 0, balanceUpdated, error: 'Impossibile recuperare i movimenti da Enable Banking' }
  }

  // Quello che la catena deterministica non categorizza, lo prova lo storico.
  const rows = fillLearnedCategories(ownerId, mapTransactions(ownerId, account.id, transactions))
  const diagnostics = summarizeMapping(rows)
  const result = insertBatch({
    ownerId,
    bankAccountId: account.id,
    source:        'enablebanking',
    filename:      `EB sync ${new Date().toISOString().slice(0, 10)}`,
    rows,
  })

  return {
    accountId:      account.id,
    insertedCount:  result.insertedCount,
    duplicateCount: result.duplicateCount,
    balanceUpdated,
    diagnostics,
  }
}

// ── Sync di una connessione (tutti i conti collegati) ─────────────────────

export interface ConnectionSyncResult {
  connectionId: number
  status:       'synced' | 'expired' | 'no-credentials'
  accounts:     AccountSyncResult[]
  // Doppioni da rinnovo del consenso riuniti al conto originale dopo la sync.
  merged?:      RenewalMerge[]
}

// Overlap applicato a `last_synced_at` per catturare movimenti contabilizzati
// in ritardo rispetto alla data valuta (comune per bonifici/addebiti SEPA).
const SYNC_OVERLAP_DAYS = 5

export async function syncConnection(connection: EbConnection): Promise<ConnectionSyncResult> {
  const now = Math.floor(Date.now() / 1000)
  if (connection.valid_until !== null && connection.valid_until < now) {
    setConnectionStatus(connection.id, 'expired')
    return { connectionId: connection.id, status: 'expired', accounts: [] }
  }

  // L'utente potrebbe aver rimosso la propria chiave EB dopo aver collegato la
  // banca: la connessione resta 'active' ma la sync non può procedere finché
  // non la reimposta nelle impostazioni.
  const creds = getEnableBankingKey(connection.owner_id)
  if (!creds) {
    return { connectionId: connection.id, status: 'no-credentials', accounts: [] }
  }

  // Un consenso revocato o chiuso dall'utente presso la banca non cambia la
  // scadenza salvata in locale: lo si scopre solo chiedendo lo stato della
  // sessione. Gli stati terminali richiedono comunque un nuovo consenso, quindi
  // finiscono tutti su 'expired' (la UI propone "Ricollega").
  const session = await checkSession(creds, decryptSessionId(connection))
  if (session.kind === 'dead') {
    setConnectionStatus(connection.id, 'expired')
    return { connectionId: connection.id, status: 'expired', accounts: [] }
  }
  if (session.kind === 'alive' && session.validUntil !== null && session.validUntil !== connection.valid_until) {
    setConnectionValidUntil(connection.id, session.validUntil)
  }

  const dateFrom = connection.last_synced_at
    ? new Date((connection.last_synced_at - SYNC_OVERLAP_DAYS * 86_400) * 1000).toISOString().slice(0, 10)
    : undefined

  const accounts = listAccountsForConnection(connection.id)
  const results: AccountSyncResult[] = []
  for (const account of accounts) {
    results.push(await syncAccount(creds, connection.owner_id, account, dateFrom))
  }

  // A shared cursor must not advance past a failed account/page.
  if (results.every((result) => !result.error)) markConnectionSynced(connection.id)
  // Dopo la sync i movimenti nuovi permettono di riconoscere un conto doppio
  // nato da un rinnovo del consenso (stessi movimenti di un conto collegato a
  // una connessione scaduta): lo storico viene riunito nel conto originale.
  const merged = autoMergeRenewalDuplicates(sqlite, connection.owner_id)
  return { connectionId: connection.id, status: 'synced', accounts: results, merged }
}
