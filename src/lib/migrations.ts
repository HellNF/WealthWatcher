// src/lib/migrations.ts
import type Database from 'better-sqlite3'

/**
 * Schema migrations for WealthWatcher.
 *
 * Every statement must be idempotent (`IF NOT EXISTS`) so it can run on every
 * boot. `messages` is the spec-discussion tool (legacy); everything else is the
 * product schema. Ownership is enforced via `owner_id` on every personal entity
 * plus the `shares` table (SPEC §2.1) so shared accounts (v2) require no refactor.
 */
export function runMigrations(db: Database.Database): void {
  db.exec(`
    -- Spec-discussion chat (legacy, unrelated to the product)
    CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      author     TEXT    NOT NULL CHECK(length(author) <= 50),
      content    TEXT    NOT NULL CHECK(length(content) <= 1000),
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- People who are allowed to authenticate. OAuth authenticates; this
    -- allowlist authorizes. No row here -> no access (SPEC §2).
    CREATE TABLE IF NOT EXISTS allowed_emails (
      email      TEXT    PRIMARY KEY,
      role       TEXT    NOT NULL DEFAULT 'member' CHECK(role IN ('admin','member')),
      note       TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Application users, created on first successful sign-in.
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      email      TEXT    NOT NULL UNIQUE,
      name       TEXT,
      image      TEXT,
      role       TEXT    NOT NULL DEFAULT 'member' CHECK(role IN ('admin','member')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Future shared access: an entity is visible to its owner OR to any user
    -- listed here. Wired now to avoid a painful refactor later (SPEC §2.1).
    CREATE TABLE IF NOT EXISTS shares (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT    NOT NULL,
      entity_id   INTEGER NOT NULL,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role        TEXT    NOT NULL DEFAULT 'viewer' CHECK(role IN ('viewer','editor')),
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(entity_type, entity_id, user_id)
    );

    -- Bank / broker. Can hold both bank accounts and investment portfolios.
    CREATE TABLE IF NOT EXISTS institutions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       TEXT    NOT NULL,
      kind       TEXT    NOT NULL DEFAULT 'bank' CHECK(kind IN ('bank','broker','both')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_institutions_owner ON institutions(owner_id);

    -- Current / savings account under an institution.
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
      owner_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name           TEXT    NOT NULL,
      currency       TEXT    NOT NULL DEFAULT 'EUR',
      created_at     INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_bank_accounts_owner ON bank_accounts(owner_id);
    CREATE INDEX IF NOT EXISTS idx_bank_accounts_institution ON bank_accounts(institution_id);
  `)
}
