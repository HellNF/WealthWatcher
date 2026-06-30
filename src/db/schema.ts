// src/db/schema.ts — Drizzle schema, source of truth for all product tables.
// Run `npm run db:generate` after editing to produce a versioned SQL migration.
import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import type { InferSelectModel } from 'drizzle-orm'

// ── allowed_emails ────────────────────────────────────────────────────────────
// People who may authenticate. No row here → no access (SPEC §2).
export const allowedEmails = sqliteTable('allowed_emails', {
  email:      text('email').primaryKey(),
  role:       text('role', { enum: ['admin', 'member'] as const }).notNull().default('member'),
  note:       text('note'),
  created_at: integer('created_at').notNull().default(sql`(unixepoch())`),
})

// ── users ─────────────────────────────────────────────────────────────────────
// Application user record, created on first successful sign-in.
export const users = sqliteTable('users', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  email:      text('email').notNull().unique(),
  name:       text('name'),
  image:      text('image'),
  role:       text('role', { enum: ['admin', 'member'] as const }).notNull().default('member'),
  created_at: integer('created_at').notNull().default(sql`(unixepoch())`),
})

// ── shares ────────────────────────────────────────────────────────────────────
// Future shared access: entity visible to owner OR any user listed here (SPEC §2.1).
export const shares = sqliteTable(
  'shares',
  {
    id:          integer('id').primaryKey({ autoIncrement: true }),
    entity_type: text('entity_type').notNull(),
    entity_id:   integer('entity_id').notNull(),
    user_id:     integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role:        text('role', { enum: ['viewer', 'editor'] as const }).notNull().default('viewer'),
    created_at:  integer('created_at').notNull().default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex('shares_entity_user_uniq').on(t.entity_type, t.entity_id, t.user_id),
  ],
)

// ── institutions ──────────────────────────────────────────────────────────────
// Bank / broker / both. Can hold bank accounts and investment portfolios.
export const institutions = sqliteTable(
  'institutions',
  {
    id:         integer('id').primaryKey({ autoIncrement: true }),
    owner_id:   integer('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name:       text('name').notNull(),
    kind:       text('kind', { enum: ['bank', 'broker', 'both'] as const }).notNull().default('bank'),
    created_at: integer('created_at').notNull().default(sql`(unixepoch())`),
  },
  (t) => [
    index('idx_institutions_owner').on(t.owner_id),
  ],
)

// ── bank_accounts ─────────────────────────────────────────────────────────────
// Current / savings account under an institution.
export const bankAccounts = sqliteTable(
  'bank_accounts',
  {
    id:             integer('id').primaryKey({ autoIncrement: true }),
    institution_id: integer('institution_id').notNull().references(() => institutions.id, { onDelete: 'cascade' }),
    owner_id:       integer('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name:           text('name').notNull(),
    currency:       text('currency').notNull().default('EUR'),
    created_at:     integer('created_at').notNull().default(sql`(unixepoch())`),
  },
  (t) => [
    index('idx_bank_accounts_owner').on(t.owner_id),
    index('idx_bank_accounts_institution').on(t.institution_id),
  ],
)

// ── categories ────────────────────────────────────────────────────────────────
// Global, seeded (src/db/seed.ts). User-visible labels for transactions.
export const categories = sqliteTable('categories', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  name:       text('name').notNull().unique(),
  kind:       text('kind', { enum: ['expense', 'income', 'transfer'] as const })
                .notNull()
                .default('expense'),
  color:      text('color').notNull().default('#6b7280'),
  created_at: integer('created_at').notNull().default(sql`(unixepoch())`),
})

// ── merchants ─────────────────────────────────────────────────────────────────
// Global, seeded. Canonical merchant names → default category. (SPEC §8.1)
export const merchants = sqliteTable('merchants', {
  id:                  integer('id').primaryKey({ autoIncrement: true }),
  canonical_name:      text('canonical_name').notNull().unique(),
  default_category_id: integer('default_category_id').references(
    () => categories.id,
    { onDelete: 'set null' },
  ),
  created_at: integer('created_at').notNull().default(sql`(unixepoch())`),
})

// ── merchant_aliases ──────────────────────────────────────────────────────────
// Lowercase substring patterns → canonical merchant. Seeded + user-expandable.
// Match: normalised(description).includes(pattern). (SPEC §8.1)
export const merchantAliases = sqliteTable('merchant_aliases', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  pattern:     text('pattern').notNull().unique(), // lowercased
  merchant_id: integer('merchant_id')
                 .notNull()
                 .references(() => merchants.id, { onDelete: 'cascade' }),
  created_at:  integer('created_at').notNull().default(sql`(unixepoch())`),
})

// ── import_batches ────────────────────────────────────────────────────────────
// Audit trail for every CSV import: provenance + dedup counts (SPEC §5.1.2).
export const importBatches = sqliteTable(
  'import_batches',
  {
    id:              integer('id').primaryKey({ autoIncrement: true }),
    owner_id:        integer('owner_id')
                       .notNull()
                       .references(() => users.id, { onDelete: 'cascade' }),
    bank_account_id: integer('bank_account_id')
                       .notNull()
                       .references(() => bankAccounts.id, { onDelete: 'cascade' }),
    source:          text('source').notNull(),      // e.g. 'intesa_csv'
    filename:        text('filename').notNull(),
    row_count:       integer('row_count').notNull(),
    inserted_count:  integer('inserted_count').notNull(),
    duplicate_count: integer('duplicate_count').notNull(),
    created_at:      integer('created_at').notNull().default(sql`(unixepoch())`),
  },
  (t) => [
    index('idx_import_batches_owner').on(t.owner_id),
  ],
)

// ── transactions ──────────────────────────────────────────────────────────────
// Bank account movements. amount_minor is signed (negative = outflow). (SPEC §8)
// Dedup key: UNIQUE(bank_account_id, dedup_hash) — hash of raw fields + in-file
// occurrence index, so two legitimately identical rows are preserved. (SPEC §5.1)
export const transactions = sqliteTable(
  'transactions',
  {
    id:               integer('id').primaryKey({ autoIncrement: true }),
    owner_id:         integer('owner_id')
                        .notNull()
                        .references(() => users.id, { onDelete: 'cascade' }),
    bank_account_id:  integer('bank_account_id')
                        .notNull()
                        .references(() => bankAccounts.id, { onDelete: 'cascade' }),
    booked_date:      text('booked_date').notNull(),     // ISO YYYY-MM-DD
    value_date:       text('value_date'),                // nullable
    amount_minor:     integer('amount_minor').notNull(), // signed, see money.ts
    currency:         text('currency').notNull().default('EUR'),
    description_raw:  text('description_raw').notNull(),
    counterparty_raw: text('counterparty_raw'),
    external_id:      text('external_id'),               // bank-provided id if any
    dedup_hash:       text('dedup_hash').notNull(),
    import_batch_id:  integer('import_batch_id').references(
                        () => importBatches.id,
                        { onDelete: 'set null' },
                      ),
    merchant_id:      integer('merchant_id').references(
                        () => merchants.id,
                        { onDelete: 'set null' },
                      ),
    category_id:      integer('category_id').references(
                        () => categories.id,
                        { onDelete: 'set null' },
                      ),
    created_at:       integer('created_at').notNull().default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex('txn_account_dedup_uniq').on(t.bank_account_id, t.dedup_hash),
    index('idx_transactions_owner_date').on(t.owner_id, t.booked_date),
    index('idx_transactions_account').on(t.bank_account_id),
  ],
)

// ── instruments ───────────────────────────────────────────────────────────────
// Global shared instrument catalogue (like categories/merchants — no owner_id).
// Upserted by symbol when a user first adds an operation for that ticker.
export const instruments = sqliteTable(
  'instruments',
  {
    id:              integer('id').primaryKey({ autoIncrement: true }),
    symbol:          text('symbol').notNull(),           // ticker, e.g. "VWCE.DE", "BTC-EUR"
    isin:            text('isin'),                       // optional
    name:            text('name').notNull(),
    cluster:         text('cluster', {
                       enum: ['etf', 'bond', 'stock', 'crypto', 'other'] as const,
                     }).notNull(),
    currency:        text('currency').notNull(),         // ISO-4217 trading currency
    ter:             text('ter'),                        // decimal string, e.g. "0.0022"
    price_source:    text('price_source', {
                       enum: ['yahoo', 'coingecko', 'alphavantage', 'manual'] as const,
                     }).notNull().default('yahoo'),
    provider_symbol: text('provider_symbol'),            // CoinGecko id or override if different from symbol
    last_price:      text('last_price'),                 // decimal string, in `currency`
    last_price_at:   integer('last_price_at'),           // unix epoch of last fetch
    created_at:      integer('created_at').notNull().default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex('instruments_symbol_uniq').on(t.symbol),
  ],
)

// ── investment_portfolios ─────────────────────────────────────────────────────
// Trading / investment account under an institution. Mirrors bank_accounts.
export const investmentPortfolios = sqliteTable(
  'investment_portfolios',
  {
    id:             integer('id').primaryKey({ autoIncrement: true }),
    institution_id: integer('institution_id')
                      .notNull()
                      .references(() => institutions.id, { onDelete: 'cascade' }),
    owner_id:       integer('owner_id')
                      .notNull()
                      .references(() => users.id, { onDelete: 'cascade' }),
    name:           text('name').notNull(),
    currency:       text('currency').notNull().default('EUR'), // reporting currency
    created_at:     integer('created_at').notNull().default(sql`(unixepoch())`),
  },
  (t) => [
    index('idx_investment_portfolios_owner').on(t.owner_id),
    index('idx_investment_portfolios_institution').on(t.institution_id),
  ],
)

// ── investment_txns ───────────────────────────────────────────────────────────
// Source-of-truth for every investment operation. Positions/lots are DERIVED.
// Monetary amounts in minor units (signed); quantities/prices as decimal strings.
export const investmentTxns = sqliteTable(
  'investment_txns',
  {
    id:            integer('id').primaryKey({ autoIncrement: true }),
    owner_id:      integer('owner_id')
                     .notNull()
                     .references(() => users.id, { onDelete: 'cascade' }),
    portfolio_id:  integer('portfolio_id')
                     .notNull()
                     .references(() => investmentPortfolios.id, { onDelete: 'cascade' }),
    instrument_id: integer('instrument_id')
                     .notNull()
                     .references(() => instruments.id),   // no cascade — history is immutable
    type:          text('type', {
                     enum: ['buy', 'sell', 'dividend', 'fee'] as const,
                   }).notNull(),
    trade_date:    text('trade_date').notNull(),          // ISO YYYY-MM-DD
    quantity:      text('quantity'),                      // decimal string; null for fee
    unit_price:    text('unit_price'),                    // decimal string, in instrument currency; null for fee
    fee_minor:     integer('fee_minor').notNull().default(0), // minor units, instrument currency
    amount_minor:  integer('amount_minor'),               // dividend cash / fee amount; null for buy/sell
    currency:      text('currency').notNull(),            // = instrument.currency
    note:          text('note'),
    created_at:    integer('created_at').notNull().default(sql`(unixepoch())`),
  },
  (t) => [
    index('idx_investment_txns_owner_date').on(t.owner_id, t.trade_date),
    index('idx_investment_txns_portfolio').on(t.portfolio_id),
    index('idx_investment_txns_instrument').on(t.instrument_id),
  ],
)

// Inferred row types — use these instead of hand-rolled interfaces.
export type AllowedEmail        = InferSelectModel<typeof allowedEmails>
export type User                = InferSelectModel<typeof users>
export type Share               = InferSelectModel<typeof shares>
export type Institution         = InferSelectModel<typeof institutions>
export type BankAccount         = InferSelectModel<typeof bankAccounts>
export type Category            = InferSelectModel<typeof categories>
export type Merchant            = InferSelectModel<typeof merchants>
export type MerchantAlias       = InferSelectModel<typeof merchantAliases>
export type ImportBatch         = InferSelectModel<typeof importBatches>
export type Transaction         = InferSelectModel<typeof transactions>
export type Instrument          = InferSelectModel<typeof instruments>
export type InvestmentPortfolio = InferSelectModel<typeof investmentPortfolios>
export type InvestmentTxn       = InferSelectModel<typeof investmentTxns>
