// src/lib/spending.ts — Fondamenta contabili per le statistiche sulle transazioni.
//
// Problema risolto: i trasferimenti tra conti propri NON sono né reddito né spesa.
// Due meccanismi complementari:
//   1. filtro sulle categorie con kind='transfer' (esplicite, vincono sempre);
//   2. rilevamento automatico delle coppie di trasferimento interno tra transazioni
//      NON categorizzate (stesso importo assoluto, segni opposti, conti diversi
//      dello stesso utente, entro ±3 giorni).
// L'insieme di id delle coppie rilevate viene iniettato nelle query via json_each.
import { sqlite } from '@/db'

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW CONTEXT — esclusione trasferimenti
// ═══════════════════════════════════════════════════════════════════════════════

export interface FlowContext {
  userId: number
  /** JSON array degli id di transazione accoppiati come trasferimenti interni. */
  excludedIdsJson: string
  /** Numero di coppie rilevate (per l'insight "transfer hygiene"). */
  pairCount: number
  /** True se le transazioni dell'utente hanno più di una valuta. */
  hasMultipleCurrencies: boolean
}

interface PairCandidate {
  id:              number
  bank_account_id: number
  booked_date:     string
  amount_minor:    number
}

const PAIR_WINDOW_DAYS = 3
const PAIR_MIN_ABS_MINOR = 100 // ignora importi < €1

/**
 * Costruisce il contesto di flusso per l'utente: rileva le coppie di
 * trasferimento interno tra transazioni non categorizzate.
 * Matching greedy 1:1: per ogni gamba negativa (in ordine di data) la gamba
 * positiva più vicina nel tempo, su un conto DIVERSO, con lo stesso |importo|,
 * entro ±3 giorni. Un rimborso (positivo sullo stesso conto) non matcha mai.
 */
export function buildFlowContext(userId: number): FlowContext {
  const currencyRow = sqlite
    .prepare(`SELECT COUNT(DISTINCT currency) AS n FROM transactions WHERE owner_id = ?`)
    .get(userId) as { n: number }
  const hasMultipleCurrencies = (currencyRow?.n ?? 0) > 1

  const accountRow = sqlite
    .prepare(`SELECT COUNT(DISTINCT bank_account_id) AS n FROM transactions WHERE owner_id = ?`)
    .get(userId) as { n: number }

  if ((accountRow?.n ?? 0) < 2) {
    return { userId, excludedIdsJson: '[]', pairCount: 0, hasMultipleCurrencies }
  }

  const candidates = sqlite
    .prepare(
      `SELECT id, bank_account_id, booked_date, amount_minor
       FROM transactions
       WHERE owner_id = ?
         AND category_id IS NULL
         AND ABS(amount_minor) >= ?
       ORDER BY booked_date ASC, id ASC`,
    )
    .all(userId, PAIR_MIN_ABS_MINOR) as PairCandidate[]

  // Bucket per importo assoluto: una coppia ha lo stesso |amount_minor|.
  const buckets = new Map<number, { neg: PairCandidate[]; pos: PairCandidate[] }>()
  for (const c of candidates) {
    const key = Math.abs(c.amount_minor)
    let b = buckets.get(key)
    if (!b) { b = { neg: [], pos: [] }; buckets.set(key, b) }
    ;(c.amount_minor < 0 ? b.neg : b.pos).push(c)
  }

  const pairedIds: number[] = []
  const windowMs = PAIR_WINDOW_DAYS * 86_400_000

  for (const { neg, pos } of buckets.values()) {
    if (neg.length === 0 || pos.length === 0) continue
    // Tutte le combinazioni valide ordinate per distanza temporale crescente,
    // poi consumo greedy 1:1: vince sempre la coppia globalmente più vicina.
    const combos: { negId: number; posId: number; delta: number }[] = []
    for (const n of neg) {
      const nMs = Date.parse(n.booked_date)
      for (const p of pos) {
        if (p.bank_account_id === n.bank_account_id) continue
        const delta = Math.abs(Date.parse(p.booked_date) - nMs)
        if (delta <= windowMs) combos.push({ negId: n.id, posId: p.id, delta })
      }
    }
    combos.sort((a, b) => a.delta - b.delta)
    const used = new Set<number>()
    for (const c of combos) {
      if (used.has(c.negId) || used.has(c.posId)) continue
      used.add(c.negId)
      used.add(c.posId)
      pairedIds.push(c.negId, c.posId)
    }
  }

  return {
    userId,
    excludedIdsJson: JSON.stringify(pairedIds),
    pairCount: pairedIds.length / 2,
    hasMultipleCurrencies,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FRAMMENTI SQL CANONICI
// ═══════════════════════════════════════════════════════════════════════════════
// Convenzione: la tabella transactions è aliasata `t` e la query usa binding
// NOMINATO con almeno { owner, excluded } (excluded = ctx.excludedIdsJson).

/** Espressione booleana SQL: la transazione è un trasferimento (esplicito o rilevato).
 *  Nota: il check IS NOT NULL evita la logica a tre valori di SQL
 *  (NULL IN (...) → NULL, che sotto NOT scarterebbe le righe non categorizzate). */
export const IS_TRANSFER_SQL = `(
  (t.category_id IS NOT NULL
   AND t.category_id IN (SELECT id FROM categories WHERE kind = 'transfer'))
  OR t.id IN (SELECT value FROM json_each(:excluded))
)`

/** WHERE per il flusso di spesa reale (uscite, trasferimenti esclusi). */
export const TRUE_EXPENSE_WHERE = `t.amount_minor < 0 AND NOT ${IS_TRANSFER_SQL}`

/** WHERE per il flusso di reddito reale (entrate, trasferimenti esclusi). */
export const TRUE_INCOME_WHERE = `t.amount_minor > 0 AND NOT ${IS_TRANSFER_SQL}`

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH CONDIVISO
// ═══════════════════════════════════════════════════════════════════════════════

export interface FlowTxn {
  id:              number
  booked_date:     string   // YYYY-MM-DD
  amount_minor:    number   // con segno
  category_id:     number | null
  category_name:   string | null
  category_kind:   string | null   // 'expense' | 'income' | 'transfer'
  merchant_id:     number | null
  merchant_name:   string | null
  description_raw: string
}

function fetchFlow(ctx: FlowContext, where: string, sinceMonths: number): FlowTxn[] {
  return sqlite
    .prepare(
      `SELECT
         t.id, t.booked_date, t.amount_minor, t.category_id,
         c.name AS category_name,
         c.kind AS category_kind,
         t.merchant_id,
         m.canonical_name AS merchant_name,
         t.description_raw
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN merchants  m ON m.id = t.merchant_id
       WHERE t.owner_id = :owner
         AND t.booked_date >= date('now', '-' || :months || ' months')
         AND ${where}
       ORDER BY t.booked_date ASC, t.id ASC`,
    )
    .all({ owner: ctx.userId, excluded: ctx.excludedIdsJson, months: sinceMonths }) as FlowTxn[]
}

/** Tutte le uscite reali (trasferimenti esclusi) degli ultimi `sinceMonths` mesi. */
export function fetchTrueExpenses(ctx: FlowContext, sinceMonths = 24): FlowTxn[] {
  return fetchFlow(ctx, TRUE_EXPENSE_WHERE, sinceMonths)
}

/** Tutte le entrate reali (trasferimenti esclusi) degli ultimi `sinceMonths` mesi. */
export function fetchTrueIncomes(ctx: FlowContext, sinceMonths = 24): FlowTxn[] {
  return fetchFlow(ctx, TRUE_INCOME_WHERE, sinceMonths)
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES STATISTICHE ROBUSTE
// ═══════════════════════════════════════════════════════════════════════════════

/** Mediana di un array (0 se vuoto). */
export function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Median Absolute Deviation: mediana degli scarti assoluti dalla mediana. */
export function mad(xs: number[]): number {
  if (xs.length === 0) return 0
  const med = median(xs)
  return median(xs.map((x) => Math.abs(x - med)))
}

/**
 * Z-score robusto: 0.6745 · (x − mediana) / MAD.
 * Il fattore 0.6745 rende il MAD comparabile alla deviazione standard
 * per distribuzioni normali. Ritorna Infinity se MAD = 0 e x ≠ mediana.
 */
export function robustZ(x: number, med: number, madValue: number): number {
  if (madValue === 0) return x === med ? 0 : Infinity
  return (0.6745 * (x - med)) / madValue
}

/** Percentile p (0..1) con interpolazione lineare (0 se vuoto). */
export function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const idx = (sorted.length - 1) * Math.min(Math.max(p, 0), 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

/** Gap in giorni tra date ISO consecutive (l'array viene ordinato). */
export function gapsInDays(datesISO: string[]): number[] {
  if (datesISO.length < 2) return []
  const sorted = [...datesISO].sort()
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    gaps.push((Date.parse(sorted[i]) - Date.parse(sorted[i - 1])) / 86_400_000)
  }
  return gaps
}

/** Mediana dei gap in giorni tra date consecutive (null se < 2 date). */
export function medianGapDays(datesISO: string[]): number | null {
  const gaps = gapsInDays(datesISO)
  return gaps.length > 0 ? median(gaps) : null
}

/**
 * Chiave stabile di raggruppamento per una transazione:
 * merchant se noto, altrimenti descrizione normalizzata.
 */
export function flowTxnKey(t: FlowTxn): string | null {
  if (t.merchant_id !== null) return `m:${t.merchant_id}`
  const k = normalizeDescKey(t.description_raw)
  return k ? `d:${k}` : null
}

/**
 * Chiave normalizzata per raggruppare transazioni senza merchant:
 * minuscole, cifre e simboli rimossi, spazi compressi.
 * Ritorna null se il residuo è troppo corto per essere significativo.
 */
export function normalizeDescKey(desc: string): string | null {
  const key = desc
    .toLowerCase()
    .replace(/[0-9]/g, '')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return key.length >= 5 ? key : null
}
