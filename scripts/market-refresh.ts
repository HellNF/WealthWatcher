// scripts/market-refresh.ts
//
// Aggiorna la cache globale dei segnali di mercato (tabella market_indicators)
// interrogando le fonti esterne gratuite (Yahoo, BCE, CoinGecko, alternative.me).
// Pensato per cron — cadenza consigliata giornaliera (gli indicatori mensili
// come i rendimenti BCE cambiano di rado, ma un refresh giornaliero è
// abbondantemente entro i rate-limit gratuiti perché è UNA sola chiamata per
// fonte per l'intera istanza, non per-utente).
//
//   npm run market-refresh
//
// I dati sono globali e condivisi: la pagina /dashboard/mercati legge SOLO da
// questa cache, quindi non fa mai fetch esterni nel render.

// Required to boot the DB and run migrations
import '@/db'
import { fetchAllMarketSignals } from '@/lib/marketOverview/sources'
import { computeAllAnalyses } from '@/lib/marketOverview/analysis'
import { writeSignals, writeAnalyses } from '@/lib/marketOverview/cache'

async function main() {
  console.log('Aggiornamento segnali di mercato…')
  const groups = await fetchAllMarketSignals()

  let total = 0
  for (const g of groups) {
    console.log(`\n${g.title}: ${g.signals.length} segnali`)
    for (const s of g.signals) {
      const pct = s.percentile !== null ? ` (${s.percentile}° pct)` : ''
      console.log(`  • ${s.title}: ${s.value}${s.unit}${pct} → ${s.levelText} [${s.source}]`)
    }
    total += g.signals.length
  }

  const flat = groups.flatMap((g) => g.signals)
  const written = writeSignals(flat)
  console.log(`\n✓ ${written}/${total} segnali salvati in cache.`)

  // Sintesi di settore argomentate (interpolano più indicatori/fonti).
  console.log('\nCalcolo sintesi di settore…')
  const analyses = await computeAllAnalyses(flat)
  for (const a of analyses) {
    console.log(`  ▸ ${a.title}: ${a.stance} (score ${a.score}, confidenza ${a.confidence})`)
    if (a.subMarkets?.length) {
      for (const s of a.subMarkets) console.log(`      – ${s.title}: ${s.stance} (${s.score})`)
    }
  }
  const wa = writeAnalyses(analyses)
  console.log(`\n✓ ${wa} sintesi di settore salvate.`)

  if (total === 0) {
    console.warn('⚠ Nessun segnale recuperato: tutte le fonti hanno fallito. La cache precedente resta invariata.')
  }
}

main().catch((err) => {
  console.error('market-refresh fallito:', err)
  process.exit(1)
})
