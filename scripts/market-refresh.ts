// scripts/market-refresh.ts
//
// Aggiorna la cache globale "Panorama Mercati" (tabella market_indicators)
// interrogando le fonti esterne gratuite: Yahoo, BCE, Eurostat, FRED, dataset
// Shiller, CoinGecko, alternative.me. Pensato per cron — cadenza giornaliera
// (vedi docker/crontab): è UNA passata per l'intera istanza, non per-utente,
// quindi ampiamente entro i limiti delle fonti.
//
//   npm run market-refresh
//
// I dati sono globali e condivisi: la pagina /dashboard/mercati legge SOLO da
// questa cache, quindi non fa mai fetch esterni nel render. La logica vive in
// src/lib/marketOverview/refresh.ts (condivisa col pulsante "Aggiorna").

// Required to boot the DB and run migrations
import '@/db'
import { runMarketRefresh } from '@/lib/marketOverview/refresh'

async function main() {
  const report = await runMarketRefresh((m) => console.log(m))
  console.log(`\n✓ ${report.signals} segnali, ${report.analyses} sintesi, ${report.macroThemes} temi macro, ${report.perfRows} mercati in ${report.finishedAt - report.startedAt}s.`)
  if (report.failures.length) {
    console.warn(`⚠ Non aggiornati (resta in cache l'ultimo valore buono): ${report.failures.join('; ')}`)
  }
  if (report.signals === 0) process.exit(1)
}

main().catch((err) => {
  console.error('market-refresh fallito:', err)
  process.exit(1)
})
