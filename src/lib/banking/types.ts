// src/lib/banking/types.ts — Forme delle risposte dell'API Enable Banking
// rilevanti per il flusso AIS (Account Information Service) usato da
// WealthWatcher: elenco banche, consenso, saldi, transazioni. Solo i campi
// che consumiamo sono tipizzati; il resto della risposta viene ignorato.
// Riferimento: https://enablebanking.com/docs/api/reference/

// Credenziali applicative per-utente (piano gratuito Enable Banking = un'app
// per account). Salvate cifrate in user_settings (src/lib/userSettings.ts) e
// passate esplicitamente a ogni chiamata di jwt.ts/client.ts.
export interface EnableBankingCredentials {
  appId:      string
  privateKey: string
}

export interface Aspsp {
  name:      string
  country:   string
  logo?:     string
  psu_types?: string[]
}

// Risposta di POST /auth — `url` è la pagina della banca a cui reindirizzare l'utente.
export interface AuthResponse {
  url: string
}

// Un conto autorizzato dal PSU, restituito dentro Session.accounts.
export interface EbAccount {
  uid:            string
  iban?:          string
  name?:          string
  product?:       string
  currency?:      string
  cash_account_type?: string
}

// Risposta di POST /sessions.
export interface Session {
  session_id: string
  accounts:   EbAccount[]
  aspsp?:     { name: string; country: string }
}

export interface EbAmount {
  amount:   string   // decimal string, es. "12.50"
  currency: string
}

export interface EbBalance {
  balance_amount: EbAmount
  balance_type:   string   // es. 'interimAvailable', 'closingBooked'
  reference_date?: string
}

export type CreditDebitIndicator = 'CRDT' | 'DBIT'

// Rappresentazione Berlin Group/NextGenPSD2 di una transazione.
export interface EbTransaction {
  entry_reference?:    string
  transaction_id?:     string
  booking_date?:        string   // ISO YYYY-MM-DD
  value_date?:          string   // ISO YYYY-MM-DD
  transaction_amount:   EbAmount
  credit_debit_indicator: CreditDebitIndicator
  remittance_information?: string[]
  creditor?: { name?: string }
  debtor?:   { name?: string }
  // Codice merchant (ISO 18245, es. 5411 = supermercati) — presente solo per
  // transazioni carta e solo se l'ASPSP lo fornisce. Usato come fallback di
  // categorizzazione quando nessuna regola utente/alias merchant fa match
  // (src/lib/merchants.ts → resolveMccCategory).
  merchant_category_code?: string
  bank_transaction_code?: { code?: string; sub_code?: string; description?: string }
}

// Risposta paginata di GET /accounts/{uid}/transactions.
export interface TransactionsResponse {
  transactions:      EbTransaction[]
  continuation_key?: string
}

export interface BalancesResponse {
  balances: EbBalance[]
}

export interface AspspsResponse {
  aspsps: Aspsp[]
}
