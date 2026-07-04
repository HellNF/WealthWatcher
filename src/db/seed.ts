// src/db/seed.ts — Idempotent global seed: default categories + known merchants/aliases.
// Called once after migrate() in src/db/index.ts. All inserts use ON CONFLICT DO NOTHING
// so re-running is safe. Extend here as new merchants / categories are needed.
import type Database from 'better-sqlite3'

type CategoryRow = { name: string; kind: 'expense' | 'income' | 'transfer'; color: string }
type MerchantRow = { canonical_name: string; category: string }
type AliasRow    = { pattern: string; merchant: string }

// ── 1. Categories (seeded globally) ──────────────────────────────────────────
const CATEGORIES: CategoryRow[] = [
  // Expenses
  { name: 'Supermercato',       kind: 'expense',  color: '#22c55e' },
  { name: 'Ristorante & Bar',   kind: 'expense',  color: '#f97316' },
  { name: 'Trasporti',          kind: 'expense',  color: '#8b5cf6' },
  { name: 'Abbonamenti',        kind: 'expense',  color: '#3b82f6' },
  { name: 'Utenze',             kind: 'expense',  color: '#06b6d4' },
  { name: 'Salute',             kind: 'expense',  color: '#ef4444' },
  { name: 'Shopping',           kind: 'expense',  color: '#ec4899' },
  { name: 'Intrattenimento',    kind: 'expense',  color: '#f59e0b' },
  { name: 'Istruzione',         kind: 'expense',  color: '#14b8a6' },
  { name: 'Carburante',         kind: 'expense',  color: '#84cc16' },
  { name: 'Tasse',              kind: 'expense',  color: '#dc2626' },
  { name: 'Altro',              kind: 'expense',  color: '#6b7280' },
  // Income
  { name: 'Stipendio',          kind: 'income',   color: '#4ade80' },
  { name: 'Entrate',            kind: 'income',   color: '#a3e635' },
  // Transfer
  { name: 'Trasferimento',      kind: 'transfer', color: '#94a3b8' },
]

// ── 2. Merchants → category name ─────────────────────────────────────────────
const MERCHANTS: MerchantRow[] = [
  // Streaming / abbonamenti
  { canonical_name: 'Netflix',          category: 'Abbonamenti' },
  { canonical_name: 'Spotify',          category: 'Abbonamenti' },
  { canonical_name: 'Amazon Prime',     category: 'Abbonamenti' },
  { canonical_name: 'YouTube Premium',  category: 'Abbonamenti' },
  { canonical_name: 'Disney+',          category: 'Abbonamenti' },
  { canonical_name: 'Apple',            category: 'Abbonamenti' },
  // Supermercati
  { canonical_name: 'Esselunga',        category: 'Supermercato' },
  { canonical_name: 'Coop',             category: 'Supermercato' },
  { canonical_name: 'Pam',              category: 'Supermercato' },
  { canonical_name: 'Eurospin',         category: 'Supermercato' },
  { canonical_name: 'Lidl',             category: 'Supermercato' },
  { canonical_name: 'Carrefour',        category: 'Supermercato' },
  { canonical_name: 'Conad',            category: 'Supermercato' },
  { canonical_name: 'Sigma',            category: 'Supermercato' },
  { canonical_name: 'Penny Market',     category: 'Supermercato' },
  // Trasporti
  { canonical_name: 'Trenitalia',       category: 'Trasporti' },
  { canonical_name: 'Italo',            category: 'Trasporti' },
  { canonical_name: 'ATM Milano',       category: 'Trasporti' },
  { canonical_name: 'Atac Roma',        category: 'Trasporti' },
  { canonical_name: 'Flixbus',          category: 'Trasporti' },
  { canonical_name: 'Uber',             category: 'Trasporti' },
  { canonical_name: 'Ryanair',          category: 'Trasporti' },
  // Carburante
  { canonical_name: 'Eni',              category: 'Carburante' },
  { canonical_name: 'Q8',               category: 'Carburante' },
  { canonical_name: 'IP',               category: 'Carburante' },
  // Utenze
  { canonical_name: 'Enel',             category: 'Utenze' },
  { canonical_name: 'Edison',           category: 'Utenze' },
  { canonical_name: 'A2A',              category: 'Utenze' },
  { canonical_name: 'Tim',              category: 'Utenze' },
  { canonical_name: 'Vodafone',         category: 'Utenze' },
  { canonical_name: 'WindTre',          category: 'Utenze' },
  // Shopping
  { canonical_name: 'Amazon',           category: 'Shopping' },
  { canonical_name: 'Zalando',          category: 'Shopping' },
  { canonical_name: 'Decathlon',        category: 'Shopping' },
  { canonical_name: 'Ikea',             category: 'Shopping' },
  { canonical_name: 'H&M',              category: 'Shopping' },
  // Salute
  { canonical_name: 'Farmacia',         category: 'Salute' },
]

// ── 3. Aliases: lowercase substrings that map to a canonical merchant ─────────
// Rule: if normalized(description_raw).includes(pattern) → that merchant is matched.
// List patterns from most specific to most general to avoid false positives.
const ALIASES: AliasRow[] = [
  // Streaming
  { pattern: 'netflix',          merchant: 'Netflix' },
  { pattern: 'spotify',          merchant: 'Spotify' },
  { pattern: 'amazon prime',     merchant: 'Amazon Prime' },
  { pattern: 'prime video',      merchant: 'Amazon Prime' },
  { pattern: 'youtube premium',  merchant: 'YouTube Premium' },
  { pattern: 'google one',       merchant: 'YouTube Premium' },
  { pattern: 'disney+',          merchant: 'Disney+' },
  { pattern: 'disneyplus',       merchant: 'Disney+' },
  { pattern: 'apple.com/bill',   merchant: 'Apple' },
  { pattern: 'apple services',   merchant: 'Apple' },
  // Supermercati
  { pattern: 'esselunga',        merchant: 'Esselunga' },
  { pattern: 'coop',             merchant: 'Coop' },
  { pattern: 'unicoop',          merchant: 'Coop' },
  { pattern: 'pam superstore',   merchant: 'Pam' },
  { pattern: 'eurospin',         merchant: 'Eurospin' },
  { pattern: 'lidl',             merchant: 'Lidl' },
  { pattern: 'carrefour',        merchant: 'Carrefour' },
  { pattern: 'conad',            merchant: 'Conad' },
  { pattern: 'sigma',            merchant: 'Sigma' },
  { pattern: 'penny market',     merchant: 'Penny Market' },
  // Trasporti
  { pattern: 'trenitalia',       merchant: 'Trenitalia' },
  { pattern: 'rfi',              merchant: 'Trenitalia' },
  { pattern: 'italo',            merchant: 'Italo' },
  { pattern: 'atm mi',           merchant: 'ATM Milano' },
  { pattern: 'atac',             merchant: 'Atac Roma' },
  { pattern: 'flixbus',          merchant: 'Flixbus' },
  { pattern: 'uber',             merchant: 'Uber' },
  { pattern: 'ryanair',          merchant: 'Ryanair' },
  // Carburante
  { pattern: 'eni gas',          merchant: 'Eni' },
  { pattern: 'eni station',      merchant: 'Eni' },
  { pattern: 'q8',               merchant: 'Q8' },
  // Utenze
  { pattern: 'enel energia',     merchant: 'Enel' },
  { pattern: 'edison energia',   merchant: 'Edison' },
  { pattern: 'a2a',              merchant: 'A2A' },
  { pattern: 'tim spa',          merchant: 'Tim' },
  { pattern: 'vodafone',         merchant: 'Vodafone' },
  { pattern: 'windtre',          merchant: 'WindTre' },
  { pattern: 'wind tre',         merchant: 'WindTre' },
  // Shopping
  { pattern: 'amazon.it',        merchant: 'Amazon' },
  { pattern: 'amazon.com',       merchant: 'Amazon' },
  { pattern: 'zalando',          merchant: 'Zalando' },
  { pattern: 'decathlon',        merchant: 'Decathlon' },
  { pattern: 'ikea',             merchant: 'Ikea' },
  // Salute
  { pattern: 'farmacia',         merchant: 'Farmacia' },
]

/**
 * Seed global reference data (categories, merchants, aliases).
 * Idempotent: ON CONFLICT DO NOTHING on all inserts.
 * Add new entries to the arrays above and they will be inserted on next boot.
 */
export function runSeed(db: Database.Database): void {
  const insertCategory = db.prepare(
    `INSERT INTO categories (name, kind, color) VALUES (?, ?, ?) ON CONFLICT(name) DO NOTHING`,
  )
  const insertMerchant = db.prepare(
    `INSERT INTO merchants (canonical_name, default_category_id)
     SELECT ?, id FROM categories WHERE name = ?
     ON CONFLICT(canonical_name) DO NOTHING`,
  )
  const insertAlias = db.prepare(
    `INSERT INTO merchant_aliases (pattern, merchant_id)
     SELECT ?, id FROM merchants WHERE canonical_name = ?
     ON CONFLICT(pattern) DO NOTHING`,
  )

  const seedAll = db.transaction(() => {
    for (const c of CATEGORIES) insertCategory.run(c.name, c.kind, c.color)
    for (const m of MERCHANTS)  insertMerchant.run(m.canonical_name, m.category)
    for (const a of ALIASES)    insertAlias.run(a.pattern, a.merchant)
  })

  seedAll()
}
