# Backup & Restore (SPEC §11)

Il database SQLite contiene i dati finanziari di **tutti** gli utenti (saldi,
transazioni, reddito, patrimonio netto): il backup è **bloccante per la v1**,
non opzionale — e il file prodotto è **cifrato**, perché un backup in chiaro
su un NAS/host esterno espone tutti quei dati a chiunque acceda a quel
supporto.

## Backup

```bash
npm run backup                 # -> data/backups/wealthwatcher-<timestamp>.db.enc
BACKUP_DIR=/mnt/nas npm run backup
```

Usa l'API di backup online di `better-sqlite3` per produrre una copia
**consistente** anche con WAL attivo (si può eseguire sul DB live senza
fermare l'app), poi cifra il risultato con **AES-256-GCM**
(`src/lib/backupCrypto.ts`) prima di scriverlo su disco: il `.db` intermedio
in chiaro è solo transitorio e viene rimosso subito dopo la cifratura. Il file
finale ha estensione `.db.enc`.

### Chiave di cifratura

```bash
# Genera con: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
BACKUP_ENCRYPTION_KEY=...
```

Se `BACKUP_ENCRYPTION_KEY` non è impostata, si usa `AUTH_SECRET` come
fallback (con un salt dedicato, diverso da quello dei segreti utente). Per
un isolamento migliore — e per poter ruotare `AUTH_SECRET` senza invalidare
i backup già fatti — imposta una chiave di backup dedicata.

> **Conserva questa chiave separatamente dai backup stessi** (es. in un
> password manager): se la perdi, i backup cifrati sono irrecuperabili.

`BACKUP_ENCRYPTION_KEY` è indipendente da `DATA_ENCRYPTION_KEY` (che invece
cifra i segreti per-utente nel DB stesso — chiavi OpenAI, Enable Banking; vedi
`src/lib/crypto.ts`). Sono due chiavi diverse per due scopi diversi: puoi
impostarne una, l'altra, entrambe o nessuna (con fallback su `AUTH_SECRET`).

### Schedulazione (HomeLab)

Esempio crontab — backup giornaliero alle 03:00, conservato off-host:

```cron
0 3 * * * cd /opt/wealthwatcher && BACKUP_DIR=/mnt/nas/ww-backups DATABASE_PATH=/data/chat.db BACKUP_ENCRYPTION_KEY=... npm run backup >> /var/log/ww-backup.log 2>&1
```

> Conserva i backup **fuori dall'host** (NAS/altro nodo) e verifica
> periodicamente il restore: un backup mai testato non è un backup.

## Restore

1. Decifra il backup scelto:
   ```bash
   npm run restore-backup -- data/backups/wealthwatcher-<timestamp>.db.enc /tmp/restore.db
   ```
2. Ferma l'app (`docker compose down`).
3. Sostituisci il file del database con il backup decifrato:
   ```bash
   cp /tmp/restore.db data/chat.db
   rm -f /tmp/restore.db  # non lasciare il .db in chiaro in giro
   # rimuovi eventuali file WAL/SHM stantii del vecchio DB
   rm -f data/chat.db-wal data/chat.db-shm
   ```
4. Riavvia (`docker compose up -d`) e verifica login + dati.
