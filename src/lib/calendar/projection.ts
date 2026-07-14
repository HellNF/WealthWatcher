// src/lib/calendar/projection.ts — Proiezione giornaliera del saldo liquido.
//
// Modello (euristica dichiarata, coerente con cashflowForecastStats):
//
//   saldo(t) = cassaOggi + baselineGiornaliera·giorni + Σ eventi "lumpy" fino a t
//
// - `baselineGiornaliera` = media netta mensile storica / 30. Cattura in modo
//   liscio il comportamento ordinario dei conti (stipendio, spesa quotidiana,
//   addebiti ricorrenti) così com'è già registrato nei movimenti bancari.
// - Gli eventi "lumpy" sovrapposti sono i soli movimenti di cassa NON già
//   contenuti nello storico dei movimenti: imposte annuali (bollo/IVAFE), rate
//   mutuo (modulo separato), eventi manuali, dividendi (da investment_txns) e
//   interessi stimati. Sono le sporgenze che la media liscia non può vedere — ed
//   esattamente ciò che genera i cali/rialzi informativi (es. il minimo di fine
//   anno per le imposte).
//
// Ricorrenti e stipendio, essendo già dentro la baseline, NON vengono riapplicati
// al saldo (niente doppio conteggio): compaiono comunque in agenda e calendario.
import type { CashProjectionPoint, DeadlineEvent } from './types'

const DAY_MS = 86_400_000

/** Fonti sovrapposte al saldo proiettato (movimenti non presenti nello storico bancario). */
export const OVERLAY_SOURCES: ReadonlySet<string> = new Set([
  'bollo', 'ivafe', 'rata_mutuo', 'custom', 'dividendo_atteso', 'interessi_conto',
])

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

export interface ProjectionResult {
  points:          CashProjectionPoint[]
  minBalanceMinor: number
  minBalanceDate:  string
}

/**
 * Costruisce la serie giornaliera del saldo proiettato su `horizonDays` a partire
 * da `from` (tipicamente oggi).
 *
 * @param events         tutti gli eventi cash dell'intervallo (verranno filtrati a OVERLAY_SOURCES)
 * @param cashStartMinor liquidità libera oggi
 * @param dailyBaselineMinor deriva giornaliera ordinaria (di norma negativa)
 */
export function buildCashProjection(
  events:             DeadlineEvent[],
  cashStartMinor:     number,
  from:               string,
  horizonDays:        number,
  dailyBaselineMinor: number,
): ProjectionResult {
  // Indicizza gli eventi lumpy per data
  const overlayByDate = new Map<string, DeadlineEvent[]>()
  for (const e of events) {
    if (e.kind !== 'cash') continue
    if (!OVERLAY_SOURCES.has(e.source)) continue
    const list = overlayByDate.get(e.date) ?? []
    list.push(e)
    overlayByDate.set(e.date, list)
  }

  const points: CashProjectionPoint[] = []
  let balance = cashStartMinor
  let minBalanceMinor = cashStartMinor
  let minBalanceDate = from

  for (let i = 0; i <= horizonDays; i++) {
    const date = addDays(from, i)
    // La deriva ordinaria si applica a ogni giorno tranne il primo (oggi = saldo noto)
    if (i > 0) balance += dailyBaselineMinor

    let inMinor = 0, outMinor = 0
    const dayEvents: CashProjectionPoint['events'] = []
    for (const e of overlayByDate.get(date) ?? []) {
      if (e.direction === 'in') { balance += e.amountMinor; inMinor += e.amountMinor }
      else if (e.direction === 'out') { balance -= e.amountMinor; outMinor += e.amountMinor }
      dayEvents.push({ label: e.label, amountMinor: e.amountMinor, direction: e.direction })
    }

    balance = Math.round(balance)
    if (balance < minBalanceMinor) { minBalanceMinor = balance; minBalanceDate = date }
    points.push({ date, balanceMinor: balance, inMinor, outMinor, events: dayEvents })
  }

  return { points, minBalanceMinor, minBalanceDate }
}
