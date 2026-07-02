// scripts/backup.ts
//
// Online SQLite backup (SPEC §11 — bloccante per v1). Uses better-sqlite3's
// backup API, which produces a consistent copy even with WAL active, so it can
// run against the live DB. Schedule it (cron) and ship the output off-host.
//
//   npm run backup            # backs up DATABASE_PATH (or data/chat.db)
//   BACKUP_DIR=/mnt/nas npm run backup
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

async function main() {
  const src = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'chat.db')
  if (!fs.existsSync(src)) {
    throw new Error(`Database non trovato: ${src}`)
  }

  const backupDir = process.env.BACKUP_DIR ?? path.join(path.dirname(src), 'backups')
  fs.mkdirSync(backupDir, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dest = path.join(backupDir, `wealthwatcher-${stamp}.db`)

  const db = new Database(src, { readonly: true })
  try {
    await db.backup(dest)
  } finally {
    db.close()
  }

  const { size } = fs.statSync(dest)
  console.log(`Backup creato: ${dest} (${(size / 1024).toFixed(0)} KB)`)
}

main().catch((err) => {
  console.error('Backup fallito:', err)
  process.exit(1)
})
