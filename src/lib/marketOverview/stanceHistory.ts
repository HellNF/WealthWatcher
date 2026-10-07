// src/lib/marketOverview/stanceHistory.ts — Storico delle valutazioni di
// settore: una rilevazione al giorno per chiave. Serve a mostrare COME è
// cambiata una valutazione ("da neutro a cautela in 3 mesi"), non solo la foto
// di oggi. Funzioni pure: la persistenza è in cache.ts.
import type { Stance } from './analysis/types'

export interface StancePoint {
  d:      string // YYYY-MM-DD
  score:  number
  stance: Stance
}

export type StanceHistory = Record<string, StancePoint[]>

const MAX_HISTORY_POINTS = 400

/** Unisce una rilevazione nello storico: una per giorno (l'ultima vince), ordinata, troncata. */
export function mergeStancePoint(points: StancePoint[], p: StancePoint, max = MAX_HISTORY_POINTS): StancePoint[] {
  const out = points.filter((x) => x.d !== p.d)
  out.push(p)
  out.sort((a, b) => a.d.localeCompare(b.d))
  return out.slice(-max)
}

/**
 * Il termine di paragone per "com'era prima": la rilevazione più recente che sia
 * vecchia di almeno `minDays` giorni rispetto all'ultima (di default ~1 mese);
 * se lo storico è più corto, la più vecchia disponibile. Null se c'è un solo punto.
 */
export function comparisonPoint(points: StancePoint[], minDays = 28): StancePoint | null {
  if (points.length < 2) return null
  const latest = points[points.length - 1]
  const cutoff = new Date(`${latest.d}T00:00:00Z`)
  cutoff.setUTCDate(cutoff.getUTCDate() - minDays)
  const iso = cutoff.toISOString().slice(0, 10)
  const older = points.filter((p) => p.d <= iso)
  return older.length ? older[older.length - 1] : points[0]
}
