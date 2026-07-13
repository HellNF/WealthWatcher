// scripts/backup.ts
//
// Online SQLite backup (SPEC §11 — bloccante per v1). Uses better-sqlite3's
// backup API, which produces a consistent copy even with WAL active, so it can
// run against the live DB. Schedule it (cron) and ship the output off-host.
//
// Il file prodotto è cifrato (AES-256-GCM, vedi src/lib/backupCrypto.ts) —
// contiene saldi, transazioni e reddito di tutti gli utenti, non va lasciato
// in chiaro su un NAS/host di backup. Il file .db intermedio (non cifrato) è
// solo transitorio e viene rimosso subito dopo la cifratura.
//
//   npm run backup            # backs up DATABASE_PATH (or data/chat.db)
//   BACKUP_DIR=/mnt/nas npm run backup
//
// Restore: npm run restore-backup -- <path-al-.db.enc> [output.db]
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { encryptBackupBuffer } from '../src/lib/backupCrypto'

async function main() {
  const src = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'chat.db')
  if (!fs.existsSync(src)) {
    throw new Error(`Database non trovato: ${src}`)
  }

  const backupDir = process.env.BACKUP_DIR ?? path.join(path.dirname(src), 'backups')
  fs.mkdirSync(backupDir, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const plainDest     = path.join(backupDir, `wealthwatcher-${stamp}.db`)
  const encryptedDest = `${plainDest}.enc`

  const db = new Database(src, { readonly: true })
  try {
    await db.backup(plainDest)
  } finally {
    db.close()
  }

  try {
    const plain = fs.readFileSync(plainDest)
    fs.writeFileSync(encryptedDest, encryptBackupBuffer(plain))
  } finally {
    // Il .db intermedio in chiaro non deve mai restare sul disco.
    fs.rmSync(plainDest, { force: true })
  }

  const { size } = fs.statSync(encryptedDest)
  console.log(`Backup cifrato creato: ${encryptedDest} (${(size / 1024).toFixed(0)} KB)`)
}

main().catch((err) => {
  console.error('Backup fallito:', err)
  process.exit(1)
})
