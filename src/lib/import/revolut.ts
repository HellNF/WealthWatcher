// src/lib/import/revolut.ts — Parser per CSV Revolut (en-US).
//
// Header atteso: Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
// - Amount: firmato (negativo = uscita)
// - Fee: sempre positivo (costo); net = Amount − Fee
// - State: importa solo COMPLETED (salta PENDING, FAILED, REVERTED, DECLINED)
// - Date: "YYYY-MM-DD HH:MM:SS" → slice(0,10)
import { createHash } from 'crypto'
import { toMinor } from '@/lib/money'
import type { ParsedRow } from './types'

// Parsing CSV minimale che gestisce campi tra virgolette.
function parseLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { inQ = !inQ }
    else if (c === ',' && !inQ) { out.push(cur); cur = '' }
    else { cur += c }
  }
  out.push(cur)
  return out
}

export function parseRevolutCsv(buffer: Buffer): ParsedRow[] {
  const lines = buffer.toString('utf-8').split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) throw new Error('File Revolut vuoto o non valido.')

  const header = parseLine(lines[0]).map((h) => h.trim())

  const C = {
    type:      header.indexOf('Type'),
    started:   header.indexOf('Started Date'),
    completed: header.indexOf('Completed Date'),
    desc:      header.indexOf('Description'),
    amount:    header.indexOf('Amount'),
    fee:       header.indexOf('Fee'),
    currency:  header.indexOf('Currency'),
    state:     header.indexOf('State'),
  }

  if ([C.amount, C.currency, C.desc, C.state].some((i) => i === -1)) {
    throw new Error(
      'Formato Revolut non riconosciuto. ' +
      'Esporta il CSV da Revolut → Conti → Estratto conto (lingua inglese).',
    )
  }

  const occurrences: Record<string, number> = {}
  const rows: ParsedRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const f = parseLine(lines[i])
    if (f.length < 8) continue

    if ((f[C.state] ?? '').trim().toUpperCase() !== 'COMPLETED') continue

    const startedDate   = (f[C.started]   ?? '').trim().slice(0, 10)
    const completedDate = (f[C.completed] ?? '').trim().slice(0, 10)
    const description   = (f[C.desc]      ?? '').trim()
    const currency      = (f[C.currency]  ?? 'EUR').trim().toUpperCase()
    const type          = (f[C.type]      ?? '').trim()

    const rawAmount = parseFloat(f[C.amount] ?? '0') || 0
    const rawFee    = parseFloat(f[C.fee]    ?? '0') || 0
    const net       = rawAmount - rawFee

    const amountMinor = toMinor(net.toFixed(4), currency)

    const rawKey = [startedDate, completedDate, description, f[C.amount], f[C.fee], currency].join('|')
    const baseHash = createHash('sha256').update(rawKey).digest('hex')
    const occ = occurrences[baseHash] ?? 0
    occurrences[baseHash] = occ + 1
    const dedupHash = occ === 0
      ? baseHash
      : createHash('sha256').update(`${rawKey}|${occ}`).digest('hex')

    rows.push({
      bookedDate:      completedDate || startedDate,
      valueDate:       startedDate || null,
      amountMinor,
      currency,
      descriptionRaw:  description,
      counterpartyRaw: description,
      intesaCategory:  type,
      dedupHash,
    })
  }

  if (rows.length === 0) {
    throw new Error('Nessun movimento COMPLETED trovato nel file Revolut.')
  }

  return rows
}
