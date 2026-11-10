import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

test('upgrade preserves existing transactions and prices, marking their provenance as legacy', () => {
  const folder = mkdtempSync(join(tmpdir(), 'wealthwatcher-migration-test-'))
  const sqlite = new Database(':memory:')
  try {
    mkdirSync(join(folder, 'meta'))
    const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'))
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 30)
    writeFileSync(join(folder, 'meta/_journal.json'), JSON.stringify(journal))
    for (const entry of journal.entries) copyFileSync(`drizzle/${entry.tag}.sql`, join(folder, `${entry.tag}.sql`))
    const db = drizzle(sqlite)
    migrate(db, { migrationsFolder: folder })
    sqlite.exec(`
      INSERT INTO users(id, email, role) VALUES (1, 'migration@example.test', 'member');
      INSERT INTO institutions(id, owner_id, name, kind) VALUES (1, 1, 'Test', 'bank');
      INSERT INTO bank_accounts(id, owner_id, institution_id, name) VALUES (1, 1, 1, 'Test');
      INSERT INTO transactions(id, owner_id, bank_account_id, booked_date, amount_minor, description_raw, dedup_hash)
        VALUES (1, 1, 1, '2026-11-01', -1299, 'Original description', 'original-hash');
      INSERT INTO instruments(id, symbol, name, cluster, currency, last_price, last_price_at)
        VALUES (1, 'TEST', 'Test', 'etf', 'EUR', '100.15', 1793010000);
      INSERT INTO price_history(instrument_id, date, price, currency, source)
        VALUES (1, '2026-11-01', '100.15', 'EUR', 'yahoo');
    `)
    migrate(db, { migrationsFolder: 'drizzle' })
    expect(sqlite.prepare('SELECT amount_minor, description_raw, dedup_hash, category_source FROM transactions').get())
      .toEqual({ amount_minor: -1299, description_raw: 'Original description', dedup_hash: 'original-hash', category_source: 'legacy' })
    expect(sqlite.prepare('SELECT price, source, kind, retrieved_at FROM price_history').get())
      .toEqual({ price: '100.15', source: 'yahoo', kind: 'legacy', retrieved_at: null })
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM price_observations').get()).toEqual({ n: 0 })
    expect(sqlite.pragma('foreign_key_check')).toEqual([])
    migrate(db, { migrationsFolder: 'drizzle' }) // idempotent restart
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM transactions').get()).toEqual({ n: 1 })
  } finally { sqlite.close(); rmSync(folder, { recursive: true, force: true }) }
})
