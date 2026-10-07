// src/lib/marketOverview/refresh.ts — Orchestrazione dell'aggiornamento della
// cache "Panorama Mercati". Usata sia dal job schedulato
// (scripts/market-refresh.ts) sia dal pulsante "Aggiorna" della pagina.
//
// Ogni blocco è indipendente: se una fonte non risponde, quel blocco viene
// saltato (resta in cache l'ultimo valore buono) e il fallimento finisce nel
// rapporto — mai ingoiato in silenzio, così la pagina può dire cosa è vecchio.
import { fetchAllMarketSignals } from './sources'
import { computeAllAnalyses } from './analysis'
import {
  writeSignals, writeAnalyses, readAnalyses, writeBlob, readBlob, appendStanceHistory,
} from './cache'
import { buildMacroOverview } from './macro'
import { buildPerformanceBoard } from './performance'
import { fetchShiller } from './shiller'
import { buildEquityEvidence, capeSignal, type EquityEvidence } from './evidence'
import { buildLookthrough } from './lookthrough'

export interface RefreshReport {
  startedAt:  number
  finishedAt: number
  signals:    number
  analyses:   number
  macroThemes: number
  perfRows:   number
  evidence:   boolean
  funds:      number     // fondi/ETF di cui si è ottenuta la composizione interna
  failures:   string[]   // blocchi non aggiornati in questo giro
}

type Log = (msg: string) => void

function withoutSeries<T extends { series?: unknown }>(x: T): Omit<T, 'series'> {
  const copy = { ...x }
  delete copy.series
  return copy
}

// Un solo refresh alla volta per processo (il pulsante può essere premuto da più utenti).
let running: Promise<RefreshReport> | null = null

export function runMarketRefresh(log: Log = () => {}): Promise<RefreshReport> {
  if (!running) running = doRefresh(log).finally(() => { running = null })
  return running
}

export function readRefreshReport(): RefreshReport | null {
  return readBlob<RefreshReport>('refresh')?.value ?? null
}

async function doRefresh(log: Log): Promise<RefreshReport> {
  const startedAt = Math.floor(Date.now() / 1000)
  const failures: string[] = []

  // 1. Segnali (grafici degli indicatori).
  log('Aggiornamento segnali di mercato…')
  const groups = await fetchAllMarketSignals()
  for (const g of groups) {
    log(`\n${g.title}: ${g.signals.length} segnali`)
    for (const s of g.signals) {
      const pct = s.percentile !== null ? ` (${s.percentile}° pct)` : ''
      log(`  • ${s.title}: ${s.value}${s.unit}${pct} → ${s.levelText} [${s.source}]`)
    }
    if (g.signals.length === 0) failures.push(`indicatori ${g.title.toLowerCase()}`)
  }
  const flat = groups.flatMap((g) => g.signals)

  // 2. Dataset Shiller → evidenze storiche + CAPE.
  log('\nDataset storico Shiller…')
  let evidence: EquityEvidence | null = null
  try {
    const rows = await fetchShiller()
    evidence = rows ? buildEquityEvidence(rows) : null
  } catch (e) {
    console.error('[market] evidenze storiche fallite:', e)
  }
  if (evidence) {
    // capeSeries serve solo al grafico: undefined → omessa dal JSON in cache.
    writeBlob('evidence', { ...evidence, capeSeries: undefined })
    flat.push(capeSignal(evidence))
    log(`  • CAPE ${evidence.cape} (${evidence.capePctAll}° pct storico), dati a ${evidence.asOf}`)
  } else {
    failures.push('evidenze storiche (dataset Shiller)')
  }
  // In cache solo i numeri: le serie dei grafici si richiedono al momento (series.ts).
  const signals = writeSignals(flat.map(withoutSeries))
  log(`\n✓ ${signals} segnali salvati in cache.`)

  // 3. Sintesi di settore + storico delle stance.
  log('\nCalcolo sintesi di settore…')
  let analysesCount = 0
  try {
    const previous = readAnalyses()
    const analyses = await computeAllAnalyses(flat, evidence)
    for (const a of analyses) {
      log(`  ▸ ${a.title}: ${a.stance} (score ${a.score}, confidenza ${a.confidence})`)
      for (const s of a.subMarkets ?? []) log(`      – ${s.title}: ${s.stance} (${s.score})`)
    }
    appendStanceHistory(analyses, previous)
    analysesCount = writeAnalyses(analyses)
  } catch (e) {
    console.error('[market] sintesi di settore fallite:', e)
    failures.push('valutazioni di settore')
  }

  // 4. Quadro macro.
  log('\nQuadro macroeconomico…')
  let macroThemes = 0
  try {
    const macro = await buildMacroOverview()
    macroThemes = macro.themes.length
    for (const t of macro.themes) log(`  ▸ ${t.title}: ${t.status}`)
    if (macroThemes > 0) {
      writeBlob('macro', { ...macro, themes: macro.themes.map((t) => ({ ...t, indicators: t.indicators.map(withoutSeries) })) })
    }
    if (macroThemes < 5) failures.push(`quadro macro (${macroThemes}/5 temi)`)
  } catch (e) {
    console.error('[market] quadro macro fallito:', e)
    failures.push('quadro macro')
  }

  // 5. Andamento dei mercati.
  log('\nAndamento dei mercati…')
  let perfRows = 0
  try {
    const board = await buildPerformanceBoard()
    perfRows = board.rows.length
    if (perfRows > 0) writeBlob('performance', board)
    else failures.push('andamento dei mercati')
    log(`  ▸ ${perfRows} mercati`)
  } catch (e) {
    console.error('[market] andamenti falliti:', e)
    failures.push('andamento dei mercati')
  }

  // 6. Composizione interna dei fondi (per l'esposizione effettiva dei portafogli).
  log('\nComposizione dei fondi…')
  let funds = 0
  try {
    const { lookthrough, requested } = await buildLookthrough()
    funds = Object.keys(lookthrough).length
    // Con zero risposte su più fondi è la fonte a essere giù: si tiene la cache.
    if (funds > 0 || requested === 0) writeBlob('lookthrough', lookthrough)
    // Un singolo fondo senza composizione pubblicata non è un guasto (in pagina
    // compare come "senza dettaglio"); lo è se non risponde nessuno.
    if (funds === 0 && requested > 0) failures.push('composizione dei fondi')
    log(`  ▸ ${funds}/${requested} fondi`)
  } catch (e) {
    console.error('[market] composizione fondi fallita:', e)
    failures.push('composizione dei fondi')
  }

  const report: RefreshReport = {
    startedAt, finishedAt: Math.floor(Date.now() / 1000),
    signals, analyses: analysesCount, macroThemes, perfRows, evidence: evidence !== null, funds, failures,
  }
  writeBlob('refresh', report)
  return report
}
