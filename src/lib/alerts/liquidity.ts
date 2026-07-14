// src/lib/alerts/liquidity.ts — Stress test liquidità a 60 giorni.
//
// Calcola il punto di minimo della funzione di cassa stimata nella finestra
// [oggi, oggi+60gg] per rilevare rischi di scoperto con anticipo sufficiente.
import { sqlite } from '@/db'
import { computeGoalsSummary } from '@/lib/goals'
import { getScadenziarioEvents } from '@/lib/calendar'
import type { DeadlineEvent } from '@/lib/calendar'

export type RunwayStatus = 'OK' | 'WARNING' | 'CRITICAL_SHORTAGE'

/** Buffer sotto il quale scatta il WARNING (€500 in minor) */
const WARNING_BUFFER_MINOR = 50_000

export interface RunwayResult {
  status:                RunwayStatus
  cashStartMinor:        number   // FreeOperatingCash al momento del calcolo
  incomeExpectedMinor:   number   // entrate attese nel periodo
  outflowsScheduledMinor: number  // uscite schedulate nel periodo
  lowestEstimatedCashMinor: number
  deficitMinor:          number   // > 0 solo in CRITICAL_SHORTAGE
  windowDays:            number   // sempre 60
  from:                  string
  to:                    string
  events:                DeadlineEvent[]
}

/**
 * Stima il saldo minimo atteso nei prossimi 60 giorni integrando entrate ricorrenti
 * note e uscite schedulate (bollo, rate mutuo, crediti in scadenza, ricorrenti).
 *
 * Il calcolo delle entrate usa la media mensile delle transazioni di categoria
 * 'income' degli ultimi 6 mesi, proratata sulla finestra di 60 giorni.
 * È un'euristica dichiarata — non pretende di essere esatta.
 */
export async function cashRunwayAlert(userId: number): Promise<RunwayResult> {
  const today   = new Date().toISOString().slice(0, 10)
  const toDate  = new Date()
  toDate.setDate(toDate.getDate() + 60)
  const to = toDate.toISOString().slice(0, 10)

  // ── Liquidità di partenza ─────────────────────────────────────────────────
  const summary    = await computeGoalsSummary(userId)
  const cashStart  = summary.freeOperatingCashMinor

  // ── Entrate attese (media mensile ultimi 6 mesi × 2 mesi) ────────────────
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const since = sixMonthsAgo.toISOString().slice(0, 10)

  const incomeRow = sqlite.prepare(`
    SELECT COALESCE(SUM(t.amount_minor), 0) AS total
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE t.owner_id = ?
      AND c.kind = 'income'
      AND t.booked_date >= ?
      AND t.booked_date <= ?
  `).get(userId, since, today) as { total: number }

  const monthlyIncome    = incomeRow.total / 6
  const heuristicIncome  = Math.round(monthlyIncome * 2)   // finestra ≈ 2 mesi

  // ── Eventi schedulati (distinti per direzione di cassa) ───────────────────
  const allEvents  = await getScadenziarioEvents(userId, today, to)
  const cashEvents = allEvents.filter(e => e.kind === 'cash')
  const outEvents  = cashEvents.filter(e => e.direction === 'out')
  const outflows   = outEvents.reduce((s, e) => s + e.amountMinor, 0)

  // Entrate attese: euristica reddito (stipendio già incluso via categoria 'income')
  // + entrate inferite che l'euristica NON cattura (dividendi, interessi stimati).
  const extraInflows = cashEvents
    .filter(e => e.direction === 'in'
      && (e.source === 'dividendo_atteso' || e.source === 'interessi_conto'))
    .reduce((s, e) => s + e.amountMinor, 0)
  const incomeExpected = heuristicIncome + extraInflows

  // ── Stima minimo di cassa ─────────────────────────────────────────────────
  const lowest = cashStart + incomeExpected - outflows

  let status: RunwayStatus = 'OK'
  if (lowest < 0) {
    status = 'CRITICAL_SHORTAGE'
  } else if (lowest < WARNING_BUFFER_MINOR) {
    status = 'WARNING'
  }

  return {
    status,
    cashStartMinor:           cashStart,
    incomeExpectedMinor:      incomeExpected,
    outflowsScheduledMinor:   outflows,
    lowestEstimatedCashMinor: lowest,
    deficitMinor:             lowest < 0 ? Math.abs(lowest) : 0,
    windowDays:               60,
    from:                     today,
    to,
    events:                   outEvents,
  }
}
