// src/lib/db.ts
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { runMigrations } from './migrations'

function initDb(): Database.Database {
  const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'chat.db')

  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }

  const db = new Database(dbPath)
  // WAL lets background jobs write while the UI reads concurrently (SPEC §10).
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)
  seedAdmin(db)
  return db
}

/**
 * Bootstrap the allowlist with an admin so a fresh deploy is reachable.
 * Idempotent: only inserts if the email is not already present.
 */
function seedAdmin(db: Database.Database): void {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase()
  if (!email) return
  db.prepare(
    `INSERT INTO allowed_emails (email, role, note)
     VALUES (?, 'admin', 'seeded from SEED_ADMIN_EMAIL')
     ON CONFLICT(email) DO NOTHING`,
  ).run(email)
}

export const db = initDb()
