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
import { normalizeDescription, resolveCategoryRule, resolveMerchant, resolveMccCategory } from '@/lib/merchants'
import { insertBatch, type InsertableTransaction } from '@/lib/transactions'
import { setAccountBalanceAnchor } from '@/lib/accounts'
import { getEnableBankingKey } from '@/lib/userSettings'
import type { BankAccount, EbConnection } from '@/db/schema'
import { getBalances, getTransactions } from './client'
import type { EbBalance, EbTransaction, EnableBankingCredentials } from './types'
import { listAccountsForConnection, markConnectionSynced, setConnectionStatus } from './connections'

// ── Mapping EbTransaction → InsertableTransaction ─────────────────────────

// Ordine di preferenza dei tipi di saldo Berlin Group/NextGenPSD2: il saldo
// contabile chiuso è il più "autorevole"; a scendere via via meno definitivo.
const BALANCE_TYPE_PRIORITY = ['closingBooked', 'interimAvailable', 'expected', 'openingBooked']

function pickBalance(balances: EbBalance[]): EbBalance | null {
  for (const type of BALANCE_TYPE_PRIORITY) {
    const found = balances.find((b) => b.balance_type === type)
    if (found) return found
  }
  return balances[0] ?? null
}

/**
 * Converte le transazioni EB in InsertableTransaction, con lo stesso schema
 * di dedup dei parser manuali (src/lib/import/intesa.ts): se l'ASPSP fornisce
 * un riferimento stabile (`entry_reference`/`transaction_id`) lo si usa come
 * base dell'hash (dedup robusto tra sync ripetuti); altrimenti si cade sui
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
    const bookedDate = t.booking_date ?? t.value_date
    if (!bookedDate) {
      console.warn('[enablebanking] transazione senza data, saltata:', t.entry_reference ?? t.transaction_id)
      continue
    }

    const currency  = t.transaction_amount.currency
    const absMinor  = toMinor(dec(t.transaction_amount.amount).abs().toString(), currency)
    const sign      = t.credit_debit_indicator === 'DBIT' ? -1 : 1
    const amountMinor = sign * absMinor

    const descriptionRaw = t.remittance_information?.length
      ? t.remittance_information.join(' ')
      : (t.creditor?.name ?? t.debtor?.name ?? 'Movimento')
    const counterpartyRaw = t.creditor?.name ?? t.debtor?.name ?? ''

    const normalized = normalizeDescription(`${descriptionRaw} ${counterpartyRaw}`)
    const merchant    = resolveMerchant(normalized)
    // Priorità: regola utente → alias merchant → MCC fornito dall'ASPSP (se presente).
    const categoryId  = resolveCategoryRule(normalized, ownerId, absMinor)
      ?? merchant?.categoryId
      ?? resolveMccCategory(t.merchant_category_code)
      ?? null

    const externalId = t.entry_reference ?? t.transaction_id ?? null
    let dedupHash: string
    if (externalId) {
      dedupHash = createHash('sha256').update(`eb:${externalId}`).digest('hex')
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
      merchant_id:      merchant?.merchantId ?? null,
      category_id:      categoryId,
    })
  }

  return mapped
}

// ── Sync di un conto ───────────────────────────────────────────────────────

export interface AccountSyncResult {
  accountId:      number
  insertedCount:  number
  duplicateCount: number
  balanceUpdated: boolean
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

  let balanceUpdated = false
  const balances = await getBalances(creds, uid)
  if (balances && balances.length > 0) {
    const chosen = pickBalance(balances)
    if (chosen) {
      const minor = toMinor(chosen.balance_amount.amount, chosen.balance_amount.currency)
      const date  = chosen.reference_date ?? new Date().toISOString().slice(0, 10)
      setAccountBalanceAnchor(ownerId, account.id, minor, date)
      balanceUpdated = true
    }
  }

  const transactions = await getTransactions(creds, uid, dateFrom)
  if (transactions === null) {
    return { accountId: account.id, insertedCount: 0, duplicateCount: 0, balanceUpdated, error: 'Impossibile recuperare i movimenti da Enable Banking' }
  }

  const rows = mapTransactions(ownerId, account.id, transactions)
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
  }
}

// ── Sync di una connessione (tutti i conti collegati) ─────────────────────

export interface ConnectionSyncResult {
  connectionId: number
  status:       'synced' | 'expired' | 'no-credentials'
  accounts:     AccountSyncResult[]
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

  const dateFrom = connection.last_synced_at
    ? new Date((connection.last_synced_at - SYNC_OVERLAP_DAYS * 86_400) * 1000).toISOString().slice(0, 10)
    : undefined

  const accounts = listAccountsForConnection(connection.id)
  const results: AccountSyncResult[] = []
  for (const account of accounts) {
    results.push(await syncAccount(creds, connection.owner_id, account, dateFrom))
  }

  markConnectionSynced(connection.id)
  return { connectionId: connection.id, status: 'synced', accounts: results }
}
