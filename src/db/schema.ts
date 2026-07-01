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
    // Manual balance anchor: the real account balance as of `anchor_date`.
    // Displayed balance = anchor_balance_minor + Σ(movimenti con booked_date > anchor_date).
    // Null = nessun saldo impostato → si somma l'intero storico movimenti.
    anchor_balance_minor: integer('anchor_balance_minor'), // signed minor units, nullable
    anchor_date:          text('anchor_date'),             // ISO YYYY-MM-DD, nullable
    // Tasso di interesse annuo lordo sulla giacenza, in percentuale (es. "2.5").
    // Null = conto non remunerato. Usato per stimare l'interesse maturato.
    interest_rate:        text('interest_rate'),           // decimal string %/anno, nullable
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
    // KID-sourced fields (populated after human review of extracted KID document)
    sri:             integer('sri'),                     // Summary Risk Indicator 1–7
    entry_cost:      text('entry_cost'),                 // decimal string, one-off entry cost %
    exit_cost:       text('exit_cost'),                  // decimal string, one-off exit cost %
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

// ── fx_history ────────────────────────────────────────────────────────────────
// Daily ECB exchange rates (base EUR). Source: Frankfurter API.
// rate means: 1 EUR = rate × quote (e.g. rate=1.08 for USD).
export const fxHistory = sqliteTable(
  'fx_history',
  {
    id:         integer('id').primaryKey({ autoIncrement: true }),
    date:       text('date').notNull(),       // ISO YYYY-MM-DD
    base:       text('base').notNull().default('EUR'),
    quote:      text('quote').notNull(),      // target currency, e.g. 'USD'
    rate:       text('rate').notNull(),       // decimal string
    created_at: integer('created_at').notNull().default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex('fx_history_date_base_quote_uniq').on(t.date, t.base, t.quote),
  ],
)

// ── price_history ─────────────────────────────────────────────────────────────
// Append-only daily price series per instrument. One row per (instrument, date).
// history is immutable — no cascade on instrument FK.
export const priceHistory = sqliteTable(
  'price_history',
  {
    id:            integer('id').primaryKey({ autoIncrement: true }),
    instrument_id: integer('instrument_id')
                     .notNull()
                     .references(() => instruments.id),  // no cascade — history is immutable
    date:          text('date').notNull(),                // ISO YYYY-MM-DD
    price:         text('price').notNull(),               // decimal string, in instrument currency
    currency:      text('currency').notNull(),
    source:        text('source'),                        // 'yahoo' | 'coingecko' | etc.
    created_at:    integer('created_at').notNull().default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex('price_history_instrument_date_uniq').on(t.instrument_id, t.date),
    index('idx_price_history_instrument').on(t.instrument_id),
  ],
)

// ── valuation_snapshots ───────────────────────────────────────────────────────
// Daily net-worth snapshot per user. Computed lazily on dashboard load.
// breakdown is a JSON string: { portfolios:[...], accounts:[...] }.
export const valuationSnapshots = sqliteTable(
  'valuation_snapshots',
  {
    id:                    integer('id').primaryKey({ autoIncrement: true }),
    owner_id:              integer('owner_id')
                             .notNull()
                             .references(() => users.id, { onDelete: 'cascade' }),
    date:                  text('date').notNull(),          // ISO YYYY-MM-DD
    net_worth_eur_minor:   integer('net_worth_eur_minor').notNull(),
    investments_eur_minor: integer('investments_eur_minor').notNull(),
    accounts_eur_minor:    integer('accounts_eur_minor').notNull(),
    breakdown:             text('breakdown'),               // JSON
    stale:                 integer('stale').notNull().default(0), // 1 if any value couldn't be converted
    created_at:            integer('created_at').notNull().default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex('valuation_snapshots_owner_date_uniq').on(t.owner_id, t.date),
    index('idx_valuation_snapshots_owner_date').on(t.owner_id, t.date),
  ],
)

// ── user_settings ─────────────────────────────────────────────────────────────
// Per-user preferences and encrypted secrets. Separate from `users` (auth row).
export const userSettings = sqliteTable('user_settings', {
  user_id:              integer('user_id').primaryKey()
                          .references(() => users.id, { onDelete: 'cascade' }),
  openai_api_key_enc:   text('openai_api_key_enc'),    // AES-256-GCM encrypted, null if not set
  openai_key_set_at:    integer('openai_key_set_at'),  // unix epoch when key was last saved
  created_at:           integer('created_at').notNull().default(sql`(unixepoch())`),
})

// ── kid_documents ─────────────────────────────────────────────────────────────
// Audit log: every KID PDF upload. Extraction stored as JSON; status set to
// 'confirmed' only after the user reviews and confirms the extracted fields.
export const kidDocuments = sqliteTable('kid_documents', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  owner_id:       integer('owner_id')
                    .notNull()
                    .references(() => users.id, { onDelete: 'cascade' }),
  instrument_id:  integer('instrument_id')
                    .references(() => instruments.id), // nullable, no cascade — audit is immutable
  filename:       text('filename').notNull(),
  extracted_json: text('extracted_json'),              // full LLM output with confidence fields
  status:         text('status', { enum: ['pending', 'confirmed'] as const })
                    .notNull()
                    .default('pending'),
  model:          text('model'),                       // e.g. 'gpt-4o-mini'
  created_at:     integer('created_at').notNull().default(sql`(unixepoch())`),
})

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
export type FxHistory           = InferSelectModel<typeof fxHistory>
export type PriceHistory        = InferSelectModel<typeof priceHistory>
export type ValuationSnapshot   = InferSelectModel<typeof valuationSnapshots>
export type UserSettings        = InferSelectModel<typeof userSettings>
export type KidDocument         = InferSelectModel<typeof kidDocuments>
