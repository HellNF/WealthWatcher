// src/lib/import/intesa.ts — Parser for Intesa Sanpaolo XLSX export.
//
// Format (as observed from the real export):
//   Sheet "Lista Operazione", rows 0–17 are metadata/preamble.
//   Row 18: header ["Data","Operazione","Dettagli","Conto o carta",
//                   "Contabilizzazione","Categoria ","Valuta","Importo",...]
//   Rows 19+: data. Trailing blank rows.
//   Dates are Excel serial integers (days since 1899-12-30).
//   Amounts are signed JS numbers (negative = outflow); no comma formatting.
import * as XLSX from 'xlsx'
import { createHash } from 'crypto'
import { toMinor } from '@/lib/money'
import type { ParsedRow } from './types'

export type { ParsedRow }

// Excel epoch: Jan 1, 1900 (with the intentional 1900 leap-year bug offset)
const EXCEL_EPOCH_MS = new Date(Date.UTC(1899, 11, 30)).getTime()

function excelSerialToISO(serial: number): string {
  const d = new Date(EXCEL_EPOCH_MS + serial * 86_400_000)
  return d.toISOString().slice(0, 10)
}

export function parseIntesaXlsx(buffer: Buffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const all = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })

  // Find the header row ("Data" is the first non-empty value in col 0)
  const headerIdx = all.findIndex(
    (r) => Array.isArray(r) && String(r[0]).trim() === 'Data',
  )
  if (headerIdx === -1) {
    throw new Error(
      'Formato Intesa non riconosciuto: riga "Data" non trovata. ' +
      'Verifica di aver esportato "Lista Operazioni" da Intesa Sanpaolo.',
    )
  }

  // Data rows: must have a numeric date serial (> 40000 = past 2009)
  const dataRows = (all.slice(headerIdx + 1) as unknown[][]).filter(
    (r) => typeof r[0] === 'number' && (r[0] as number) > 40_000,
  )

  // Track hash occurrences within this file to handle legitimate duplicates
  // (e.g. two identical €4.59 Coop transactions on the same day). SPEC §5.1.
  const occurrences: Record<string, number> = {}

  return dataRows.map((row) => {
    const dateSerial     = row[0] as number
    const operazione     = String(row[1] ?? '').trim()
    const dettagli       = String(row[2] ?? '').trim()
    const currency       = String(row[6] ?? 'EUR').trim().toUpperCase()
    const rawAmount      = row[7] as number
    const intesaCategory = String(row[5] ?? '').trim()

    const bookedDate = excelSerialToISO(dateSerial)

    // Use toFixed(2) to avoid IEEE-754 drift before passing to toMinor.
    // Intesa amounts always have at most 2 decimal places.
    const amountMinor = toMinor(rawAmount.toFixed(2), currency)

    // Base hash: SHA-256 of all distinguishing raw fields.
    // Dettagli includes POS timestamp codes (e.g. "25/060944") making each
    // genuine transaction unique. Only edge case is "N.D" (cash deposits).
    const rawKey = [dateSerial, operazione, dettagli, String(rawAmount), currency].join('|')
    const baseHash = createHash('sha256').update(rawKey).digest('hex')

    // If the same rawKey appeared before in this file, bump the occurrence
    // index so both rows get distinct hashes and are both preserved in the DB.
    const occ = occurrences[baseHash] ?? 0
    occurrences[baseHash] = occ + 1
    const dedupHash =
      occ === 0
        ? baseHash
        : createHash('sha256').update(`${rawKey}|${occ}`).digest('hex')

    return {
      bookedDate,
      amountMinor,
      currency,
      descriptionRaw:  operazione,
      counterpartyRaw: dettagli,
      intesaCategory,
      dedupHash,
    }
  })
}
