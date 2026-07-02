// src/lib/import/bbva.ts — Parser per l'export XLSX di BBVA (Italia).
//
// Formato osservato (foglio "Informe BBVA"):
//   Righe 0–3: preambolo/metadati ("Movimenti", "Data di generazione…").
//   Riga 4: header ["", "Data valuta", "Data", "Causale", "Movimento",
//                   "Beneficiario", "Importo"].
//   Righe 5+: dati. Date in gg/mm/aaaa. L'importo è una stringa tipo
//   "-30.04 EUR" / "450 EUR" (punto come separatore decimale, valuta in coda).
//   Nessun id transazione fornito → dedup via hash dei campi grezzi + indice
//   occorrenza in-file (esistono duplicati legittimi). (SPEC §5.1)
import * as XLSX from 'xlsx'
import { createHash } from 'crypto'
import { toMinor } from '@/lib/money'
import type { ParsedRow } from './types'

function toISO(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.trim().split('/')
  return `${y}-${m}-${d}`
}

// Normalizza "1.234,56" / "1,234.56" / "-30.04" → stringa decimale con punto.
function normalizeAmount(numeric: string): string {
  const s = numeric.trim()
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    // Il separatore decimale è l'ultimo che compare.
    return s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')   // europeo: . migliaia, , decimali
      : s.replace(/,/g, '')                        // anglosassone: , migliaia, . decimali
  }
  if (hasComma) return s.replace(',', '.')
  return s
}

function cleanCounterparty(raw: string): string {
  // "-\n-" e simili placeholder → vuoto; altrimenti compatta gli a-capo.
  const c = raw.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
  return /^[-\s]*$/.test(c) ? '' : c
}

export function parseBbvaXlsx(buffer: Buffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const all = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })

  const headerIdx = all.findIndex(
    (r) => Array.isArray(r) && String(r[1]).trim() === 'Data valuta' && String(r[6]).trim() === 'Importo',
  )
  if (headerIdx === -1) {
    throw new Error(
      'Formato BBVA non riconosciuto: header "Data valuta … Importo" non trovato. ' +
      'Verifica di aver esportato i movimenti da BBVA in formato Excel.',
    )
  }

  const dataRows = (all.slice(headerIdx + 1) as unknown[][]).filter(
    (r) => typeof r[2] === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(String(r[2]).trim()),
  )

  const occurrences: Record<string, number> = {}

  return dataRows.map((row) => {
    const valueDateRaw = String(row[1] ?? '').trim()
    const bookDateRaw  = String(row[2] ?? '').trim()
    const causale      = String(row[3] ?? '').trim()
    const movimento    = String(row[4] ?? '').trim()
    const beneficiario = cleanCounterparty(String(row[5] ?? ''))
    const importoRaw   = String(row[6] ?? '').trim()

    const m = importoRaw.match(/^\s*(-?[\d.,]+)\s*([A-Za-z]{3})\s*$/)
    if (!m) {
      throw new Error(`Importo BBVA non interpretabile: "${importoRaw}"`)
    }
    const currency    = m[2].toUpperCase()
    const amountMinor = toMinor(normalizeAmount(m[1]), currency)

    const bookedDate = toISO(bookDateRaw)
    const valueDate  = valueDateRaw ? toISO(valueDateRaw) : null

    // La controparte utile per il matching merchant sta nella Causale;
    // il Beneficiario (nome/IBAN per i bonifici) la arricchisce.
    const counterpartyRaw = beneficiario || movimento

    const rawKey = [valueDateRaw, bookDateRaw, causale, movimento, beneficiario, importoRaw].join('|')
    const baseHash = createHash('sha256').update(rawKey).digest('hex')
    const occ = occurrences[baseHash] ?? 0
    occurrences[baseHash] = occ + 1
    const dedupHash =
      occ === 0 ? baseHash : createHash('sha256').update(`${rawKey}|${occ}`).digest('hex')

    return {
      bookedDate,
      valueDate,
      amountMinor,
      currency,
      descriptionRaw:  causale,
      counterpartyRaw,
      intesaCategory:  '', // BBVA non fornisce una categoria propria
      dedupHash,
    }
  })
}
