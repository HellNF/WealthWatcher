// scripts/snapshot.ts
//
// Compute and store a ValuationSnapshot for all users (net worth in EUR).
// Run once per day via cron or manually.
//
//   npm run snapshot              # snapshot for today
//   REFRESH_PRICES=1 npm run snapshot   # also refresh instrument prices first
//
// The script mirrors the lazy on-load behaviour but can be used for backfill
// or scheduling from an external cron job.

// Required to boot the DB and run migrations
import '@/db'
import { sqlite } from '@/db'
import { takeSnapshot } from '@/lib/valuation'
import { refreshPortfolioPrices } from '@/lib/prices/index'
import { refreshVehicleEstimate } from '@/lib/prices/vehicleEstimate'
import { listPortfolios } from '@/lib/portfolios'
import { listAssets, getVehicleDetails } from '@/lib/assets'

async function main() {
  const users = sqlite.prepare('SELECT id FROM users').all() as { id: number }[]

  if (users.length === 0) {
    console.log('Nessun utente trovato.')
    return
  }

  for (const { id: userId } of users) {
    console.log(`\nUtente ${userId}:`)

    if (process.env.REFRESH_PRICES === '1') {
      const portfolios = listPortfolios(userId)
      for (const portfolio of portfolios) {
        console.log(`  Aggiornamento prezzi portafoglio #${portfolio.id} "${portfolio.name}"...`)
        await refreshPortfolioPrices(userId, portfolio.id)
      }

      const vehicles = listAssets(userId).filter((a) => a.kind === 'vehicle')
      for (const asset of vehicles) {
        const details = getVehicleDetails(asset.id)
        if (!details) continue // asset 'vehicle' senza dati identificativi — nulla da stimare
        console.log(`  Stima valore veicolo "${asset.name}" (${details.make} ${details.model})...`)
        const result = await refreshVehicleEstimate(asset, details)
        if (result.stale) console.log('    ⚠ stima non aggiornata (fetch fallito) — valore precedente mantenuto')
      }
    }

    const snapshot = await takeSnapshot(userId)
    const staleNote = snapshot.stale ? ' ⚠ parziale' : ''
    // Il net worth per-utente non va nei log di default (finiscono su file/cron
    // log, spesso meno protetti del DB): mostralo solo con SNAPSHOT_VERBOSE=1,
    // per debug locale manuale.
    if (process.env.SNAPSHOT_VERBOSE === '1') {
      const eur = (snapshot.net_worth_eur_minor / 100).toLocaleString('it-IT', {
        style: 'currency',
        currency: 'EUR',
      })
      console.log(`  Net worth ${snapshot.date}: ${eur}${staleNote}`)
    } else {
      console.log(`  Snapshot ${snapshot.date} salvato${staleNote}`)
    }
  }
}

main().catch((err) => {
  console.error('Snapshot fallito:', err)
  process.exit(1)
})
