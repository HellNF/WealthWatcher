// src/lib/spending.ts — Fondamenta contabili per le statistiche sulle transazioni.
//
// Problema risolto: i trasferimenti tra conti propri NON sono né reddito né spesa.
// Due meccanismi complementari:
//   1. filtro sulle categorie con kind='transfer' (esplicite, vincono sempre);
//   2. coppie di giroconto proposte tra transazioni NON categorizzate (stesso
//      importo e valuta, segni opposti, conti diversi, entro ±3 giorni) e non
//      rifiutate dall'utente — vedi src/lib/transfers.ts.
// L'insieme di id delle coppie rilevate viene iniettato nelle query via json_each.
import { sqlite } from '@/db'
import { suggestTransfers } from '@/lib/transfers'

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

/**
 * Costruisce il contesto di flusso per l'utente. Le coppie di giroconto
 * proposte tra movimenti ancora senza categoria vengono escluse dalle
 * statistiche anche senza conferma (src/lib/transfers.ts); quelle confermate
 * hanno già la categoria di trasferimento, quelle rifiutate restano flussi.
 */
export function buildFlowContext(userId: number): FlowContext {
  const currencyRow = sqlite
    .prepare(`SELECT COUNT(DISTINCT currency) AS n FROM transactions WHERE owner_id = ?`)
    .get(userId) as { n: number }
  const hasMultipleCurrencies = (currencyRow?.n ?? 0) > 1

  const pairs = suggestTransfers(userId).filter((p) => p.autoExcluded)
  return {
    userId,
    excludedIdsJson: JSON.stringify(pairs.flatMap((p) => [p.outflow.id, p.inflow.id])),
    pairCount: pairs.length,
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
const TRUE_INCOME_WHERE = `t.amount_minor > 0 AND NOT ${IS_TRANSFER_SQL}`

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH CONDIVISO
// ═══════════════════════════════════════════════════════════════════════════════

export interface FlowTxn {
  id:              number
  booked_date:     string   // YYYY-MM-DD
  amount_minor:    number   // con segno
  bank_account_id: number
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
         t.id, t.booked_date, t.amount_minor, t.bank_account_id, t.category_id,
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
