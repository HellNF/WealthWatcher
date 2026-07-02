// src/db/index.ts — Database singleton: Drizzle ORM + raw better-sqlite3 connection.
//
// Exports:
//   db     — Drizzle instance for all product queries (type-safe, schema-aware)
//   sqlite — raw better-sqlite3 connection for legacy chat, backup scripts, and tests
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import fs from 'fs'
import path from 'path'

import * as schema from './schema'
import { runSeed } from './seed'

function initDb() {
  const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'chat.db')

  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }

  const sqlite = new Database(dbPath)
  // WAL lets background jobs write while the UI reads concurrently (SPEC §10).
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  const db = drizzle(sqlite, { schema })

  // Skip all data operations during `next build` — multiple parallel workers
  // would race on migrate() causing "table already exists" errors.
  // `NEXT_PHASE` is not always available in every build worker, so also detect
  // build from the CLI args as a fallback.
  const isBuild =
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.argv.some((arg) => arg.includes('next') && arg.includes('build'))

  if (!isBuild) {
    // Apply versioned SQL migrations from drizzle/ (idempotent, ordered by filename).
    // drizzle-kit generate produces these; commit them alongside schema changes.
    migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') })

    // Legacy spec-discussion chat — kept on raw driver, not in Drizzle schema.
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        author     TEXT    NOT NULL CHECK(length(author) <= 50),
        content    TEXT    NOT NULL CHECK(length(content) <= 1000),
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `)

    seedAdmin(sqlite)
    runSeed(sqlite)
  }

  return { sqlite, db }
}

/**
 * Bootstrap the allowlist with an admin so a fresh deploy is reachable.
 * Idempotent: only inserts if the email is not already present.
 */
function seedAdmin(sqlite: Database.Database): void {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase()
  if (!email) return
  sqlite
    .prepare(
      `INSERT INTO allowed_emails (email, role, note)
       VALUES (?, 'admin', 'seeded from SEED_ADMIN_EMAIL')
       ON CONFLICT(email) DO NOTHING`,
    )
    .run(email)
}

const { sqlite, db } = initDb()

export { sqlite, db }
