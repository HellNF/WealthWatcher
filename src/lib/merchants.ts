// src/lib/merchants.ts — Merchant resolution, category rules, and category fallback.
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

// ── Category rules ────────────────────────────────────────────────────────────

export interface CategoryRuleRow {
  id:            number
  pattern:       string
  category_id:   number
  category_name: string
  priority:      number
  created_at:    number
}

/**
 * Check per-user keyword rules against a normalised description.
 * Returns the category_id of the highest-priority matching rule, or null.
 */
export function resolveCategoryRule(normalizedDesc: string, ownerId: number): number | null {
  const row = sqlite
    .prepare(
      `SELECT cr.category_id
       FROM category_rules cr
       WHERE cr.owner_id = ?
         AND ? LIKE '%' || cr.pattern || '%'
       ORDER BY cr.priority DESC, length(cr.pattern) DESC
       LIMIT 1`,
    )
    .get(ownerId, normalizedDesc) as { category_id: number } | undefined
  return row?.category_id ?? null
}

export function listCategoryRules(ownerId: number): CategoryRuleRow[] {
  return sqlite
    .prepare(
      `SELECT cr.id, cr.pattern, cr.category_id, c.name AS category_name,
              cr.priority, cr.created_at
       FROM category_rules cr
       JOIN categories c ON c.id = cr.category_id
       WHERE cr.owner_id = ?
       ORDER BY cr.priority DESC, length(cr.pattern) DESC`,
    )
    .all(ownerId) as CategoryRuleRow[]
}

export function createCategoryRule(
  ownerId:    number,
  pattern:    string,
  categoryId: number,
  priority:   number = 0,
): { ok: true; id: number } | { ok: false; error: string } {
  const clean = pattern.trim().toLowerCase()
  if (!clean) return { ok: false, error: 'Il pattern non può essere vuoto.' }
  try {
    const result = sqlite
      .prepare(
        `INSERT INTO category_rules (owner_id, pattern, category_id, priority)
         VALUES (?, ?, ?, ?)`,
      )
      .run(ownerId, clean, categoryId, priority)
    return { ok: true, id: Number(result.lastInsertRowid) }
  } catch {
    return { ok: false, error: `Regola già esistente per il pattern "${clean}".` }
  }
}

export function deleteCategoryRule(id: number, ownerId: number): void {
  sqlite
    .prepare('DELETE FROM category_rules WHERE id = ? AND owner_id = ?')
    .run(id, ownerId)
}

export function updateCategoryRulePriority(id: number, ownerId: number, priority: number): void {
  sqlite
    .prepare('UPDATE category_rules SET priority = ? WHERE id = ? AND owner_id = ?')
    .run(priority, id, ownerId)
}
