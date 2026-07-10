// scripts/bank-sync.ts
//
// Sincronizza tutte le connessioni Open Banking (Enable Banking) attive di
// tutti gli utenti: saldi + movimenti. Pensato per essere eseguito da cron
// (es. una volta al giorno), sullo stesso principio di scripts/snapshot.ts —
// la sync manuale da UI (SyncButton) chiama la stessa funzione sync.ts.
//
//   npm run bank-sync

// Required to boot the DB and run migrations
import '@/db'
import { listActiveConnections } from '@/lib/banking/connections'
import { syncConnection } from '@/lib/banking/sync'

async function main() {
  const connections = listActiveConnections()
  if (connections.length === 0) {
    console.log('Nessuna connessione Open Banking attiva.')
    return
  }

  for (const connection of connections) {
    console.log(`\nConnessione #${connection.id} (${connection.aspsp_name}, utente ${connection.owner_id})...`)
    try {
      const result = await syncConnection(connection)
      if (result.status === 'expired') {
        console.log('  ⚠ sessione scaduta — serve riconnessione manuale dall\'app')
        continue
      }
      if (result.status === 'no-credentials') {
        console.log('  ⚠ chiave Enable Banking non configurata dall\'utente — sync saltata')
        continue
      }
      for (const acc of result.accounts) {
        if (acc.error) {
          console.log(`  Conto #${acc.accountId}: ⚠ ${acc.error}`)
        } else {
          console.log(`  Conto #${acc.accountId}: ${acc.insertedCount} inseriti, ${acc.duplicateCount} duplicati`)
        }
      }
    } catch (err) {
      console.error(`  Sync fallita:`, err)
    }
  }
}

main().catch((err) => {
  console.error('bank-sync fallito:', err)
  process.exit(1)
})
