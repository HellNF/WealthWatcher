// src/lib/transfers.ts — Giroconti tra conti propri.
//
// Un giroconto non è né spesa né reddito. Tre stati:
//   • proposto  — due movimenti speculari (stesso importo e valuta, segni
//                 opposti, conti diversi, entro PAIR_WINDOW_DAYS): ricalcolato
//                 ogni volta, mai salvato;
//   • confermato — l'utente ha detto sì: la coppia è salvata in transfer_links
//                 e i due movimenti ricevono la categoria di tipo trasferimento
//                 (scelta manuale), così report e statistiche li escludono con
//                 la stessa regola di qualsiasi trasferimento categorizzato;
//   • rifiutato  — coincidenza: salvata e mai più proposta.
//
// Le proposte considerano anche i movimenti categorizzati in automatico (è lì
// che si nascondono i bonifici verso un proprio conto, a volte con una
// categoria sbagliata), mai quelli con una scelta manuale o una regola
// dell'utente. Una coppia con un solo lato già "trasferimento" viene proposta:
// confermarla corregge l'altro lato. Solo le proposte tra movimenti
// ancora senza categoria vengono escluse dalle statistiche senza conferma,
// come prima dell'introduzione delle conferme.
import { sqlite } from '@/db'

const PAIR_WINDOW_DAYS = 3
const PAIR_MIN_ABS_MINOR = 100 // ignora importi sotto l'unità

export interface TransferLeg {
  id:              number
  bank_account_id: number
  account_name:    string
  booked_date:     string
  amount_minor:    number
  currency:        string
  description_raw: string
  category_id:     number | null
  /** 1 se la categoria attuale è già di tipo trasferimento. */
  is_transfer:     number
}

export interface TransferSuggestion {
  outflow: TransferLeg
  inflow:  TransferLeg
  /** Entrambi senza categoria: già esclusi dalle statistiche anche senza conferma. */
  autoExcluded: boolean
}

export interface ConfirmedTransfer {
  linkId:  number
  outflow: TransferLeg
  inflow:  TransferLeg
}

const LEG_COLUMNS = `t.id, t.bank_account_id, ba.name AS account_name, t.booked_date, t.amount_minor,
  t.currency, t.description_raw, t.category_id,
  (t.category_id IN (SELECT id FROM categories WHERE kind = 'transfer')) AS is_transfer`

/** Categoria assegnata ai giroconti confermati. */
export function transferCategoryId(): number | null {
  const row = sqlite.prepare(
    `SELECT id FROM categories WHERE kind = 'transfer' ORDER BY (name = 'Trasferimento') DESC, id LIMIT 1`,
  ).get() as { id: number } | undefined
  return row?.id ?? null
}

/**
 * Coppie proposte, abbinamento greedy 1:1: tutte le combinazioni valide
 * ordinate per distanza temporale, vince sempre la coppia più vicina. Un
 * rimborso sullo stesso conto non viene mai abbinato.
 */
export function suggestTransfers(userId: number): TransferSuggestion[] {
  const candidates = sqlite.prepare(
    `SELECT ${LEG_COLUMNS}
     FROM transactions t
     JOIN bank_accounts ba ON ba.id = t.bank_account_id
     WHERE t.owner_id = ?
       AND ABS(t.amount_minor) >= ?
       AND (t.category_id IS NULL OR t.category_source NOT IN ('manual', 'rule'))
       AND t.id NOT IN (SELECT outflow_id FROM transfer_links WHERE status = 'confirmed')
       AND t.id NOT IN (SELECT inflow_id  FROM transfer_links WHERE status = 'confirmed')
     ORDER BY t.booked_date ASC, t.id ASC`,
  ).all(userId, PAIR_MIN_ABS_MINOR) as TransferLeg[]
  if (candidates.length < 2) return []

  const rejected = new Set((sqlite.prepare(
    `SELECT outflow_id, inflow_id FROM transfer_links WHERE owner_id = ? AND status = 'rejected'`,
  ).all(userId) as { outflow_id: number; inflow_id: number }[]).map((r) => `${r.outflow_id}:${r.inflow_id}`))

  // Una coppia ha stessa valuta e stesso importo assoluto.
  const buckets = new Map<string, { out: TransferLeg[]; in: TransferLeg[] }>()
  for (const c of candidates) {
    const key = `${c.currency}:${Math.abs(c.amount_minor)}`
    const b = buckets.get(key) ?? { out: [], in: [] }
    buckets.set(key, b)
    ;(c.amount_minor < 0 ? b.out : b.in).push(c)
  }

  const windowMs = PAIR_WINDOW_DAYS * 86_400_000
  const suggestions: TransferSuggestion[] = []
  for (const { out, in: inflows } of buckets.values()) {
    if (out.length === 0 || inflows.length === 0) continue
    const combos: { o: TransferLeg; i: TransferLeg; delta: number }[] = []
    for (const o of out) {
      const oMs = Date.parse(o.booked_date)
      for (const i of inflows) {
        if (i.bank_account_id === o.bank_account_id || rejected.has(`${o.id}:${i.id}`)) continue
        // Entrambi già trasferimenti: nulla da correggere né da proporre.
        if (o.is_transfer && i.is_transfer) continue
        const delta = Math.abs(Date.parse(i.booked_date) - oMs)
        if (delta <= windowMs) combos.push({ o, i, delta })
      }
    }
    combos.sort((a, b) => a.delta - b.delta || a.o.id - b.o.id || a.i.id - b.i.id)
    const used = new Set<number>()
    for (const { o, i } of combos) {
      if (used.has(o.id) || used.has(i.id)) continue
      used.add(o.id); used.add(i.id)
      suggestions.push({ outflow: o, inflow: i, autoExcluded: o.category_id === null && i.category_id === null })
    }
  }
  return suggestions.sort((a, b) => b.outflow.booked_date.localeCompare(a.outflow.booked_date))
}

/** Giroconti confermati dall'utente, più recenti prima. */
export function listConfirmedTransfers(userId: number): ConfirmedTransfer[] {
  const links = sqlite.prepare(
    `SELECT id, outflow_id, inflow_id FROM transfer_links
     WHERE owner_id = ? AND status = 'confirmed'`,
  ).all(userId) as { id: number; outflow_id: number; inflow_id: number }[]
  const leg = sqlite.prepare(
    `SELECT ${LEG_COLUMNS} FROM transactions t JOIN bank_accounts ba ON ba.id = t.bank_account_id
     WHERE t.id = ? AND t.owner_id = ?`)
  return links.flatMap((l) => {
    const outflow = leg.get(l.outflow_id, userId) as TransferLeg | undefined
    const inflow = leg.get(l.inflow_id, userId) as TransferLeg | undefined
    return outflow && inflow ? [{ linkId: l.id, outflow, inflow }] : []
  }).sort((a, b) => b.outflow.booked_date.localeCompare(a.outflow.booked_date))
}

export type TransferDecisionError =
  | 'not-found' | 'not-a-pair' | 'already-confirmed' | 'no-transfer-category'

function loadPair(userId: number, outflowId: number, inflowId: number):
  { outflow: TransferLeg; inflow: TransferLeg } | 'not-found' | 'not-a-pair' {
  const leg = sqlite.prepare(
    `SELECT ${LEG_COLUMNS} FROM transactions t JOIN bank_accounts ba ON ba.id = t.bank_account_id
     WHERE t.id = ? AND t.owner_id = ?`)
  const outflow = leg.get(outflowId, userId) as TransferLeg | undefined
  const inflow = leg.get(inflowId, userId) as TransferLeg | undefined
  if (!outflow || !inflow) return 'not-found'
  const speculari = outflow.amount_minor < 0 && inflow.amount_minor === -outflow.amount_minor
    && outflow.currency === inflow.currency && outflow.bank_account_id !== inflow.bank_account_id
  return speculari ? { outflow, inflow } : 'not-a-pair'
}

/**
 * Conferma una coppia: la salva e assegna ai due movimenti la categoria di
 * trasferimento come scelta manuale. Rifiuta coppie non speculari o movimenti
 * già parte di un altro giroconto confermato.
 */
export function confirmTransfer(userId: number, outflowId: number, inflowId: number):
  { ok: true } | { ok: false; error: TransferDecisionError } {
  return sqlite.transaction(() => {
    const pair = loadPair(userId, outflowId, inflowId)
    if (typeof pair === 'string') return { ok: false as const, error: pair }
    const busy = sqlite.prepare(
      `SELECT 1 FROM transfer_links WHERE status = 'confirmed'
       AND (outflow_id IN (?, ?) OR inflow_id IN (?, ?))`,
    ).get(outflowId, inflowId, outflowId, inflowId)
    if (busy) return { ok: false as const, error: 'already-confirmed' as const }
    const categoryId = transferCategoryId()
    if (categoryId === null) return { ok: false as const, error: 'no-transfer-category' as const }
    sqlite.prepare(
      `INSERT INTO transfer_links (owner_id, outflow_id, inflow_id, status) VALUES (?, ?, ?, 'confirmed')
       ON CONFLICT (outflow_id, inflow_id) DO UPDATE SET status = 'confirmed'`,
    ).run(userId, outflowId, inflowId)
    sqlite.prepare(
      `UPDATE transactions SET category_id = ?, category_source = 'manual' WHERE owner_id = ? AND id IN (?, ?)`,
    ).run(categoryId, userId, outflowId, inflowId)
    return { ok: true as const }
  })()
}

/** Segna la coppia come coincidenza: non verrà più proposta né esclusa. */
export function rejectTransfer(userId: number, outflowId: number, inflowId: number):
  { ok: true } | { ok: false; error: TransferDecisionError } {
  const pair = loadPair(userId, outflowId, inflowId)
  if (typeof pair === 'string') return { ok: false, error: pair }
  const existing = sqlite.prepare(
    `SELECT status FROM transfer_links WHERE outflow_id = ? AND inflow_id = ?`,
  ).get(outflowId, inflowId) as { status: string } | undefined
  if (existing?.status === 'confirmed') return { ok: false, error: 'already-confirmed' }
  sqlite.prepare(
    `INSERT INTO transfer_links (owner_id, outflow_id, inflow_id, status) VALUES (?, ?, ?, 'rejected')
     ON CONFLICT (outflow_id, inflow_id) DO NOTHING`,
  ).run(userId, outflowId, inflowId)
  return { ok: true }
}

/**
 * Annulla un giroconto confermato: la coppia torna una proposta e i due
 * movimenti perdono la categoria di trasferimento (tornano senza categoria).
 */
export function undoTransfer(userId: number, linkId: number): boolean {
  return sqlite.transaction(() => {
    const link = sqlite.prepare(
      `SELECT outflow_id, inflow_id FROM transfer_links WHERE id = ? AND owner_id = ? AND status = 'confirmed'`,
    ).get(linkId, userId) as { outflow_id: number; inflow_id: number } | undefined
    if (!link) return false
    sqlite.prepare('DELETE FROM transfer_links WHERE id = ?').run(linkId)
    sqlite.prepare(
      `UPDATE transactions SET category_id = NULL, category_source = 'automatic'
       WHERE owner_id = ? AND id IN (?, ?)
         AND category_id IN (SELECT id FROM categories WHERE kind = 'transfer')`,
    ).run(userId, link.outflow_id, link.inflow_id)
    return true
  })()
}
