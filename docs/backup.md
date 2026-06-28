# Backup & Restore (SPEC §11)

Il database SQLite contiene i dati finanziari di tutti gli utenti: il backup è
**bloccante per la v1**, non opzionale.

## Backup

```bash
npm run backup                 # -> data/backups/wealthwatcher-<timestamp>.db
BACKUP_DIR=/mnt/nas npm run backup
```

Usa l'API di backup online di `better-sqlite3`: produce una copia **consistente**
anche con WAL attivo, quindi si può eseguire sul DB live senza fermare l'app.

### Schedulazione (HomeLab)

Esempio crontab — backup giornaliero alle 03:00, conservato off-host:

```cron
0 3 * * * cd /opt/wealthwatcher && BACKUP_DIR=/mnt/nas/ww-backups DATABASE_PATH=/data/chat.db npm run backup >> /var/log/ww-backup.log 2>&1
```

> Conserva i backup **fuori dall'host** (NAS/altro nodo) e verifica
> periodicamente il restore: un backup mai testato non è un backup.

## Restore

1. Ferma l'app (`docker compose down`).
2. Sostituisci il file del database con il backup scelto:
   ```bash
   cp data/backups/wealthwatcher-<timestamp>.db data/chat.db
   # rimuovi eventuali file WAL/SHM stantii del vecchio DB
   rm -f data/chat.db-wal data/chat.db-shm
   ```
3. Riavvia (`docker compose up -d`) e verifica login + dati.
