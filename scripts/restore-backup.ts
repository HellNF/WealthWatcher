// scripts/restore-backup.ts
//
// Decifra un backup prodotto da `npm run backup` (vedi scripts/backup.ts /
// src/lib/backupCrypto.ts) per poterlo ripristinare. Serve la stessa chiave
// (BACKUP_ENCRYPTION_KEY, o AUTH_SECRET se il backup è stato cifrato col
// fallback) usata al momento della cifratura.
//
//   npm run restore-backup -- data/backups/wealthwatcher-<timestamp>.db.enc
//   npm run restore-backup -- data/backups/wealthwatcher-<timestamp>.db.enc data/chat.db
//
// Il file di output NON viene scritto sopra il DB live automaticamente:
// segui la procedura di restore in docs/backup.md (ferma l'app, sostituisci
// il file, rimuovi i WAL/SHM stantii, riavvia).
import fs from 'fs'
import path from 'path'
import { decryptBackupBuffer } from '../src/lib/backupCrypto'

function main() {
  const [encryptedPathArg, outputPathArg] = process.argv.slice(2)
  if (!encryptedPathArg) {
    console.error('Uso: npm run restore-backup -- <path-al-.db.enc> [output.db]')
    process.exit(1)
  }

  const encryptedPath = path.resolve(encryptedPathArg)
  if (!fs.existsSync(encryptedPath)) {
    throw new Error(`File non trovato: ${encryptedPath}`)
  }

  const outputPath = outputPathArg
    ? path.resolve(outputPathArg)
    : encryptedPath.replace(/\.enc$/, '')

  if (outputPath === encryptedPath) {
    throw new Error('Il path di output non può coincidere con il file cifrato di partenza')
  }

  const encrypted = fs.readFileSync(encryptedPath)
  const plain = decryptBackupBuffer(encrypted)
  fs.writeFileSync(outputPath, plain)

  console.log(`Backup decifrato: ${outputPath} (${(plain.length / 1024).toFixed(0)} KB)`)
}

main()
