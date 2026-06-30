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
import { listPortfolios } from '@/lib/portfolios'

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
    }

    const snapshot = await takeSnapshot(userId)
    const eur = (snapshot.net_worth_eur_minor / 100).toLocaleString('it-IT', {
      style: 'currency',
      currency: 'EUR',
    })
    const staleNote = snapshot.stale ? ' ⚠ parziale' : ''
    console.log(`  Net worth ${snapshot.date}: ${eur}${staleNote}`)
  }
}

main().catch((err) => {
  console.error('Snapshot fallito:', err)
  process.exit(1)
})
