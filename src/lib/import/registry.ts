// src/lib/import/registry.ts — Mappa parser-id → funzione di parsing.
import type { BankParser } from './types'
import { parseIntesaXlsx } from './intesa'
import { parseBbvaXlsx } from './bbva'
import { parseRevolutCsv } from './revolut'

export const PARSERS: Record<string, BankParser> = {
  intesa_xlsx:  parseIntesaXlsx,
  bbva_xlsx:    parseBbvaXlsx,
  revolut_csv:  parseRevolutCsv,
}
