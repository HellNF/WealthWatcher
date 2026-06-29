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

// Inferred row types — use these instead of hand-rolled interfaces.
export type AllowedEmail = InferSelectModel<typeof allowedEmails>
export type User         = InferSelectModel<typeof users>
export type Share        = InferSelectModel<typeof shares>
export type Institution  = InferSelectModel<typeof institutions>
export type BankAccount  = InferSelectModel<typeof bankAccounts>
