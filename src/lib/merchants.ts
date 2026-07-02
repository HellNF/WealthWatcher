// src/lib/merchants.ts — Merchant resolution and category fallback.
import { eq } from 'drizzle-orm'
import { db, sqlite } from '@/db'
import { categories } from '@/db/schema'

// ── Description normalisation ─────────────────────────────────────────────────

/**
 * Strip POS noise from Intesa's raw `Dettagli` / `Operazione` field so that
 * the normalised string can be matched against alias patterns reliably.
 *
 * Removes: date/time codes ("25/060944"), card numbers, ABI codes, COD. refs,
 * city suffix + POS word, extra whitespace.
 */
export function normalizeDescription(raw: string): string {
  return raw
    .toLowerCase()
    // COD. references "cod.3010905/000815" — must strip before date codes
    .replace(/cod\.\S+/g, '')
    // ABI codes "abi 09517"
    .replace(/abi\s+\d+/g, '')
    // date-time codes e.g. "25/060944", "18/062147"
    .replace(/\d{2}\/\d{6}/g, '')
    // card number patterns "carta n.xxxx xxxx xxxx xxxx"
    .replace(/carta\s+n\.\s*[\dx\s]+/gi, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Intesa → WealthWatcher category fallback ──────────────────────────────────
// Used when no merchant alias matches — Intesa already classifies transactions.

const INTESA_CATEGORY_MAP: Record<string, string> = {
  'Generi alimentari e supermercato': 'Supermercato',
  'Ristoranti e locali':              'Ristorante & Bar',
  'Treno, aereo, nave':               'Trasporti',
  'Carburante':                        'Carburante',
  'Spese mediche':                     'Salute',
  'Shopping':                          'Shopping',
  'Abbonamenti':                       'Abbonamenti',
  'Istruzione':                        'Istruzione',
  'Bonifici in uscita':                'Trasferimento',
  'Bonifici in entrata':               'Entrate',
  'Regali ricevuti':                   'Entrate',
  'Entrate varie':                     'Entrate',
  'Stipendio':                         'Stipendio',
  'Addebiti vari':                     'Altro',
  'Altre uscite':                      'Altro',
}

export function resolveIntesaCategory(intesaCategory: string): number | null {
  const myName = INTESA_CATEGORY_MAP[intesaCategory]
  if (!myName) return null
  const row = db.select({ id: categories.id }).from(categories).where(eq(categories.name, myName)).get()
  return row?.id ?? null
}

// ── Alias-based merchant resolution ──────────────────────────────────────────

export interface ResolvedMerchant {
  merchantId: number
  categoryId: number | null
}

/**
 * Match a normalised description against seeded alias patterns (substring).
 * Uses a SQL LIKE query so the match runs in the database layer.
 * Returns null if no alias matches.
 */
export function resolveMerchant(normalizedDesc: string): ResolvedMerchant | null {
  const row = sqlite
    .prepare(
      `SELECT ma.merchant_id, m.default_category_id
       FROM merchant_aliases ma
       JOIN merchants m ON m.id = ma.merchant_id
       WHERE ? LIKE '%' || ma.pattern || '%'
       LIMIT 1`,
    )
    .get(normalizedDesc) as
    | { merchant_id: number; default_category_id: number | null }
    | undefined

  if (!row) return null
  return { merchantId: row.merchant_id, categoryId: row.default_category_id }
}
