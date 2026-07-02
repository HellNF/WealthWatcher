// src/lib/import/types.ts — Shape condivisa dei parser di estratto conto.
// Ogni parser bancario (intesa, bbva, …) produce righe in questo formato, che
// l'import action mappa su InsertableTransaction. `bankCategory` è l'eventuale
// etichetta di categoria fornita dalla banca ('' se non ne fornisce).
export interface ParsedRow {
  bookedDate:      string          // YYYY-MM-DD
  valueDate?:      string | null   // YYYY-MM-DD, se disponibile
  amountMinor:     number          // signed integer minor units
  currency:        string
  descriptionRaw:  string          // nome/merchant "pulito"
  counterpartyRaw: string          // controparte / dettagli grezzi
  intesaCategory:  string          // etichetta categoria della banca ('' se assente)
  dedupHash:       string          // SHA-256 dei campi grezzi + indice occorrenza in-file
}

export type BankParser = (buffer: Buffer) => ParsedRow[]
