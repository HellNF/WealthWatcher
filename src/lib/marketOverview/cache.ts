// src/lib/marketOverview/cache.ts — Lettura/scrittura della cache globale dei
// segnali di mercato (tabella market_indicators). Il job market-refresh scrive,
// la pagina legge. Nessun fetch esterno qui: solo (de)serializzazione JSON.
import { sqlite } from '@/db'
import type { MarketSignal } from './signals'
import type { SectorAnalysis } from './analysis/types'
import { mergeStancePoint, type StanceHistory } from './stanceHistory'

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
export function writeSignals(signals: (Omit<MarketSignal, 'series'> | null)[]): number {
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
        .prepare("SELECT code, payload, updated_at FROM market_indicators WHERE code NOT LIKE 'analysis.%' AND code NOT LIKE 'blob.%' ORDER BY code")
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

// ── Blob generici ─────────────────────────────────────────────────────────────
// Strutture che non sono né MarketSignal né SectorAnalysis (tabella andamenti,
// quadro macro, evidenze storiche, storico delle stance) vivono sotto codici
// `blob.<nome>` nella stessa tabella: stesso principio "schema applicativo".

export function writeBlob(name: string, value: unknown): void {
  sqlite
    .prepare(
      `INSERT INTO market_indicators (code, payload, updated_at)
       VALUES (?, ?, unixepoch())
       ON CONFLICT(code) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    )
    .run(`blob.${name}`, JSON.stringify(value))
}

export function readBlob<T>(name: string): { value: T; cachedAt: number } | null {
  const row = sqlite
    .prepare('SELECT payload, updated_at FROM market_indicators WHERE code = ?')
    .get(`blob.${name}`) as { payload: string; updated_at: number } | undefined
  if (!row) return null
  try {
    return { value: JSON.parse(row.payload) as T, cachedAt: row.updated_at }
  } catch {
    console.warn(`[market] blob corrotto "${name}", ignorato`)
    return null
  }
}

// ── Storico delle stance ──────────────────────────────────────────────────────
// Persistenza dello storico (logica pura in stanceHistory.ts).

const isoDay = (epoch: number) => new Date(epoch * 1000).toISOString().slice(0, 10)

/**
 * Aggiunge allo storico le analisi appena calcolate. Al primo avvio lo storico è
 * vuoto: vi si riversano prima le analisi già in cache (con la LORO data), così
 * il confronto "rispetto all'ultima rilevazione" funziona da subito.
 */
export function appendStanceHistory(fresh: SectorAnalysis[], previous: CachedAnalysis[]): StanceHistory {
  const history: StanceHistory = readBlob<StanceHistory>('history')?.value ?? {}
  const flat = (list: SectorAnalysis[]) => list.flatMap((a) => [a, ...(a.subMarkets ?? [])])

  for (const prev of previous) {
    for (const a of flat([prev])) {
      if (history[a.key]?.length) continue
      history[a.key] = [{ d: isoDay(prev.cachedAt), score: a.score, stance: a.stance }]
    }
  }
  const today = isoDay(Math.floor(Date.now() / 1000))
  for (const a of flat(fresh)) {
    history[a.key] = mergeStancePoint(history[a.key] ?? [], { d: today, score: a.score, stance: a.stance })
  }
  writeBlob('history', history)
  return history
}

export function readStanceHistory(): StanceHistory {
  return readBlob<StanceHistory>('history')?.value ?? {}
}
