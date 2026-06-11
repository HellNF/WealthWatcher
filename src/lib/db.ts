// src/lib/db.ts
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

function initDb(): Database.Database {
  const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'chat.db')

  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }

  const db = new Database(dbPath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      author     TEXT    NOT NULL CHECK(length(author) <= 50),
      content    TEXT    NOT NULL CHECK(length(content) <= 1000),
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  return db
}

export const db = initDb()
