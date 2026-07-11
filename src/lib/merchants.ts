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

// ── Merchant Category Code (MCC) → WealthWatcher category fallback ───────────
// Usato per le transazioni Open Banking (Enable Banking): a differenza degli
// export bancari proprietari (es. Intesa), il Berlin Group/NextGenPSD2 non ha
// una tassonomia di categoria propria, ma alcuni ASPSP espongono l'MCC
// standard ISO 18245 delle transazioni carta. Copertura non esaustiva (~600
// codici esistono in tutto): mappa i codici più comuni, sullo stesso principio
// di INTESA_CATEGORY_MAP — un fallback "meglio di niente", con priorità più
// bassa delle regole utente e degli alias merchant.
const MCC_CATEGORY_MAP: Record<string, string> = {
  // Supermercati e alimentari
  '5411': 'Supermercato', '5422': 'Supermercato', '5441': 'Supermercato',
  '5451': 'Supermercato', '5462': 'Supermercato', '5499': 'Supermercato',
  // Ristoranti e bar
  '5812': 'Ristorante & Bar', '5813': 'Ristorante & Bar', '5814': 'Ristorante & Bar',
  // Trasporti
  '4111': 'Trasporti', '4112': 'Trasporti', '4121': 'Trasporti', '4131': 'Trasporti',
  '4511': 'Trasporti', '4784': 'Trasporti', '7512': 'Trasporti', '7523': 'Trasporti',
  // Carburante
  '5541': 'Carburante', '5542': 'Carburante',
  // Salute
  '8011': 'Salute', '8021': 'Salute', '8031': 'Salute', '8041': 'Salute',
  '8042': 'Salute', '8043': 'Salute', '8049': 'Salute', '8050': 'Salute',
  '8062': 'Salute', '8071': 'Salute', '8099': 'Salute', '5122': 'Salute', '5912': 'Salute',
  // Shopping
  '5311': 'Shopping', '5331': 'Shopping', '5399': 'Shopping', '5611': 'Shopping',
  '5621': 'Shopping', '5631': 'Shopping', '5641': 'Shopping', '5651': 'Shopping',
  '5661': 'Shopping', '5691': 'Shopping', '5732': 'Shopping', '5940': 'Shopping',
  '5945': 'Shopping', '5999': 'Shopping',
  // Abbonamenti (telco, pay-TV, subscription merchants)
  '4814': 'Abbonamenti', '4899': 'Abbonamenti', '5968': 'Abbonamenti',
  // Utenze
  '4900': 'Utenze',
  // Istruzione
  '8211': 'Istruzione', '8220': 'Istruzione', '8241': 'Istruzione',
  '8244': 'Istruzione', '8249': 'Istruzione', '8299': 'Istruzione',
  // Intrattenimento
  '7832': 'Intrattenimento', '7922': 'Intrattenimento', '7929': 'Intrattenimento',
  '7996': 'Intrattenimento', '7997': 'Intrattenimento', '7998': 'Intrattenimento',
  '7999': 'Intrattenimento', '5815': 'Intrattenimento',
}

export function resolveMccCategory(mcc: string | undefined | null): number | null {
  if (!mcc) return null
  const myName = MCC_CATEGORY_MAP[mcc.trim()]
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
  id:               number
  pattern:          string
  category_id:      number
  category_name:    string
  priority:         number
  amount_minor_min: number | null
  amount_minor_max: number | null
  created_at:       number
}

/**
 * Check per-user keyword rules against a normalised description and optional amount.
 * `absAmountMinor` should be Math.abs(transaction.amount_minor).
 * Returns the category_id of the highest-priority matching rule, or null.
 * Rules with amount constraints win over unconstrained rules at equal priority.
 */
export function resolveCategoryRule(
  normalizedDesc: string,
  ownerId:        number,
  absAmountMinor?: number,
): number | null {
  const amt = absAmountMinor ?? null
  const row = sqlite
    .prepare(
      `SELECT cr.category_id
       FROM category_rules cr
       WHERE cr.owner_id = ?
         AND ? LIKE '%' || cr.pattern || '%'
         AND (cr.amount_minor_min IS NULL OR ? >= cr.amount_minor_min)
         AND (cr.amount_minor_max IS NULL OR ? <= cr.amount_minor_max)
       ORDER BY
         cr.priority DESC,
         (cr.amount_minor_min IS NOT NULL OR cr.amount_minor_max IS NOT NULL) DESC,
         length(cr.pattern) DESC
       LIMIT 1`,
    )
    .get(ownerId, normalizedDesc, amt, amt) as { category_id: number } | undefined
  return row?.category_id ?? null
}

export function listCategoryRules(ownerId: number): CategoryRuleRow[] {
  return sqlite
    .prepare(
      `SELECT cr.id, cr.pattern, cr.category_id, c.name AS category_name,
              cr.priority, cr.amount_minor_min, cr.amount_minor_max, cr.created_at
       FROM category_rules cr
       JOIN categories c ON c.id = cr.category_id
       WHERE cr.owner_id = ?
       ORDER BY cr.priority DESC, length(cr.pattern) DESC`,
    )
    .all(ownerId) as CategoryRuleRow[]
}

export function createCategoryRule(
  ownerId:         number,
  pattern:         string,
  categoryId:      number,
  priority:        number = 0,
  amountMinorMin?: number | null,
  amountMinorMax?: number | null,
): { ok: true; id: number } | { ok: false; error: string } {
  const clean = pattern.trim().toLowerCase()
  if (!clean) return { ok: false, error: 'Il pattern non può essere vuoto.' }
  try {
    const result = sqlite
      .prepare(
        `INSERT INTO category_rules
           (owner_id, pattern, category_id, priority, amount_minor_min, amount_minor_max)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(ownerId, clean, categoryId, priority, amountMinorMin ?? null, amountMinorMax ?? null)
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
