// src/lib/marketOverview/cache.ts — Lettura/scrittura della cache globale dei
// segnali di mercato (tabella market_indicators). Il job market-refresh scrive,
// la pagina legge. Nessun fetch esterno qui: solo (de)serializzazione JSON.
import { sqlite } from '@/db'
import type { MarketSignal } from './signals'
import type { SectorAnalysis } from './analysis/types'

/** Segnale letto dalla cache, arricchito con l'istante di ultimo refresh. */
export interface CachedSignal extends MarketSignal {
  cachedAt: number // unix epoch dell'ultimo market-refresh per questo code
}

/**
 * Upsert idempotente di un batch di segnali. Un segnale `null` (fonte non
 * disponibile al refresh) viene ignorato: si preferisce mantenere l'ultimo
 * valore buono in cache piuttosto che cancellarlo — la UI mostrerà la data
 * "aggiornato al…" così l'utente vede se un dato è vecchio.
 */
export function writeSignals(signals: (MarketSignal | null)[]): number {
  const stmt = sqlite.prepare(
    `INSERT INTO market_indicators (code, payload, updated_at)
     VALUES (?, ?, unixepoch())
     ON CONFLICT(code) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
  )
  let written = 0
  const run = sqlite.transaction(() => {
    for (const s of signals) {
      if (!s) continue
      stmt.run(s.code, JSON.stringify(s))
      written++
    }
  })
  run()
  return written
}

/**
 * Legge tutti i segnali in cache (o solo quelli con i code richiesti),
 * ordinati per code. Righe con payload corrotto vengono saltate senza abbattere
 * la pagina.
 */
export function readSignals(codes?: string[]): CachedSignal[] {
  const rows = (codes && codes.length
    ? sqlite
        .prepare(
          `SELECT code, payload, updated_at FROM market_indicators
           WHERE code IN (${codes.map(() => '?').join(',')}) ORDER BY code`,
        )
        .all(...codes)
    : sqlite
        .prepare("SELECT code, payload, updated_at FROM market_indicators WHERE code NOT LIKE 'analysis.%' ORDER BY code")
        .all()) as { code: string; payload: string; updated_at: number }[]

  const out: CachedSignal[] = []
  for (const r of rows) {
    try {
      const signal = JSON.parse(r.payload) as MarketSignal
      out.push({ ...signal, cachedAt: r.updated_at })
    } catch {
      console.warn(`[market] payload corrotto per code "${r.code}", saltato`)
    }
  }
  return out
}

// ── Sintesi di settore ────────────────────────────────────────────────────────
// Salvate sotto codici `analysis.<settore>` nella stessa tabella (payload JSON
// generico). Tenute separate dai MarketSignal, che alimentano i grafici.

export interface CachedAnalysis extends SectorAnalysis {
  cachedAt: number
}

export function writeAnalyses(analyses: SectorAnalysis[]): number {
  const stmt = sqlite.prepare(
    `INSERT INTO market_indicators (code, payload, updated_at)
     VALUES (?, ?, unixepoch())
     ON CONFLICT(code) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
  )
  let written = 0
  const run = sqlite.transaction(() => {
    for (const a of analyses) {
      stmt.run(`analysis.${a.key}`, JSON.stringify(a))
      written++
    }
  })
  run()
  return written
}

export function readAnalyses(): CachedAnalysis[] {
  const rows = sqlite
    .prepare("SELECT code, payload, updated_at FROM market_indicators WHERE code LIKE 'analysis.%' ORDER BY code")
    .all() as { code: string; payload: string; updated_at: number }[]

  const out: CachedAnalysis[] = []
  for (const r of rows) {
    try {
      const a = JSON.parse(r.payload) as SectorAnalysis
      out.push({ ...a, cachedAt: r.updated_at })
    } catch {
      console.warn(`[market] analisi corrotta per code "${r.code}", saltata`)
    }
  }
  return out
}
