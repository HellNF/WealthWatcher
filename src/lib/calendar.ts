// src/lib/calendar.ts — Scadenziario fiscale e patrimoniale.
//
// Aggrega scadenze deterministiche da tutti i moduli dell'app in una coda
// cronologica strutturata per data. Riusa esclusivamente funzioni esistenti;
// aggiunge solo le date statutarie mancanti (bollo, IVAFE, ecc.).
import { estimatedWealthTaxes } from '@/lib/tax/wealth'
import { computeFiscalWallet } from '@/lib/tax/wallet'
import { listMortgages, amortizationSchedule } from '@/lib/mortgages'
import { sqlite } from '@/db'

export type DeadlineSource = 'bollo' | 'ivafe' | 'credito_fiscale' | 'rata_mutuo' | 'ricorrente' | 'custom'

export interface DeadlineEvent {
  id?:         number           // presente solo per eventi custom (deletable)
  date:        string           // ISO YYYY-MM-DD
  source:      DeadlineSource
  label:       string
  amountMinor: number           // sempre positivo (uscita o valore credito a rischio)
  meta?: Record<string, unknown>
}

// ── Scadenze bollo/IVAFE ───────────────────────────────────────────────────────
// Bollo conti → 31 dicembre; IVAFE → 30 giugno (saldo) e 30 novembre (acconto 40%)

async function wealthDeadlines(userId: number, year: string, from: string, to: string): Promise<DeadlineEvent[]> {
  const wealthTaxes = await estimatedWealthTaxes(userId, year)
  const events: DeadlineEvent[] = []

  for (const line of wealthTaxes.lines) {
    if (line.taxEurMinor === 0) continue

    if (line.regime === 'bollo') {
      const d = `${year}-12-31`
      if (d >= from && d <= to) {
        events.push({
          date:        d,
          source:      'bollo',
          label:       `Imposta di bollo — ${line.name}`,
          amountMinor: line.taxEurMinor,
          meta:        { kind: line.kind, id: line.id },
        })
      }
    } else {
      // IVAFE: saldo 30/06, acconto 30/11 (40% del totale)
      const saldo   = `${year}-06-30`
      const acconto = `${year}-11-30`
      const saldoAmt   = Math.round(line.taxEurMinor * 0.6)
      const accontoAmt = Math.round(line.taxEurMinor * 0.4)

      if (saldo >= from && saldo <= to && saldoAmt > 0) {
        events.push({ date: saldo,   source: 'ivafe', label: `IVAFE saldo — ${line.name}`,   amountMinor: saldoAmt,   meta: { kind: line.kind, id: line.id } })
      }
      if (acconto >= from && acconto <= to && accontoAmt > 0) {
        events.push({ date: acconto, source: 'ivafe', label: `IVAFE acconto — ${line.name}`, amountMinor: accontoAmt, meta: { kind: line.kind, id: line.id } })
      }
    }
  }
  return events
}

// ── Crediti fiscali in scadenza ────────────────────────────────────────────────

function creditDeadlines(userId: number, from: string, to: string): DeadlineEvent[] {
  const wallet = computeFiscalWallet(userId)
  return wallet.credits
    .filter(c => c.amountMinor > 0 && c.expiryDate >= from && c.expiryDate <= to)
    .map(c => ({
      date:        c.expiryDate,
      source:      'credito_fiscale' as DeadlineSource,
      label:       `Scadenza credito minusvalenza (${c.expiryDate.slice(0, 4)})`,
      amountMinor: c.amountMinor,
      meta:        { expiryDate: c.expiryDate },
    }))
}

// ── Rate mutuo ─────────────────────────────────────────────────────────────────

function mortgageDeadlines(userId: number, from: string, to: string): DeadlineEvent[] {
  const events: DeadlineEvent[] = []
  for (const m of listMortgages(userId)) {
    for (const row of amortizationSchedule(m)) {
      if (row.date < from) continue
      if (row.date > to)   break
      events.push({
        date:        row.date,
        source:      'rata_mutuo',
        label:       `Rata mutuo — ${m.name}`,
        amountMinor: row.paymentMinor,
        meta:        {
          mortgageId:    m.id,
          interestMinor: row.interestMinor,
          principalMinor: row.principalMinor,
          monthIndex:    row.monthIndex,
        },
      })
    }
  }
  return events
}

// ── Pagamenti ricorrenti ───────────────────────────────────────────────────────
// Stima la prossima occorrenza nel range basandosi sull'ultimo addebito rilevato
// (stessa logica di analytics.ts:recurringPayments ma proiettata in avanti).

interface RecurringRow {
  merchant_name:  string | null
  description:    string
  amount_minor:   number
  last_date:      string
  month_count:    number
}

function recurringDeadlines(userId: number, from: string, to: string): DeadlineEvent[] {
  const MIN_MONTHS = 3

  const rows = sqlite.prepare(`
    SELECT
      m.canonical_name                        AS merchant_name,
      LOWER(TRIM(t.description_raw))          AS description,
      ROUND(AVG(t.amount_minor))              AS amount_minor,
      MAX(t.booked_date)                      AS last_date,
      COUNT(DISTINCT SUBSTR(t.booked_date,1,7)) AS month_count
    FROM transactions t
    LEFT JOIN merchants m ON m.id = t.merchant_id
    WHERE t.owner_id = ?
      AND t.amount_minor < 0
    GROUP BY COALESCE(m.canonical_name, LOWER(TRIM(t.description_raw)))
    HAVING month_count >= ?
    ORDER BY ABS(amount_minor) DESC
    LIMIT 50
  `).all(userId, MIN_MONTHS) as RecurringRow[]

  const events: DeadlineEvent[] = []

  for (const r of rows) {
    // Proietta la prossima occorrenza a +1 mese dalla data dell'ultimo addebito
    const last = new Date(r.last_date)
    last.setMonth(last.getMonth() + 1)
    const nextDate = last.toISOString().slice(0, 10)

    if (nextDate < from || nextDate > to) continue

    const label = r.merchant_name ?? r.description.slice(0, 40)
    events.push({
      date:        nextDate,
      source:      'ricorrente',
      label:       `Addebito ricorrente — ${label}`,
      amountMinor: Math.abs(r.amount_minor),
      meta:        { merchantName: r.merchant_name, description: r.description },
    })
  }
  return events
}

// ── Eventi personalizzati ─────────────────────────────────────────────────────

interface CustomEventRow {
  id:           number
  date:         string
  label:        string
  amount_minor: number
}

function customEventDeadlines(userId: number, from: string, to: string): DeadlineEvent[] {
  const rows = sqlite.prepare(`
    SELECT id, date, label, amount_minor
    FROM calendar_events
    WHERE owner_id = ? AND date >= ? AND date <= ?
    ORDER BY date
  `).all(userId, from, to) as CustomEventRow[]

  return rows.map(r => ({
    id:          r.id,
    date:        r.date,
    source:      'custom' as DeadlineSource,
    label:       r.label,
    amountMinor: r.amount_minor,
  }))
}

export function createCustomEvent(
  userId:      number,
  date:        string,
  label:       string,
  amountMinor: number,
  note?:       string,
): void {
  sqlite.prepare(`
    INSERT INTO calendar_events (owner_id, date, label, amount_minor, note)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, date, label, amountMinor, note ?? null)
}

export function deleteCustomEvent(userId: number, eventId: number): void {
  sqlite.prepare(`
    DELETE FROM calendar_events WHERE id = ? AND owner_id = ?
  `).run(eventId, userId)
}

// ── Funzione principale ───────────────────────────────────────────────────────

/**
 * Restituisce tutti gli eventi di scadenza nell'intervallo [from, to] (ISO YYYY-MM-DD),
 * ordinati per data crescente.
 */
export async function getFiscalCalendar(
  userId: number,
  from: string,
  to: string,
): Promise<DeadlineEvent[]> {
  const year = from.slice(0, 4)

  const events: DeadlineEvent[] = [
    ...(await wealthDeadlines(userId, year, from, to)),
    ...creditDeadlines(userId, from, to),
    ...mortgageDeadlines(userId, from, to),
    ...recurringDeadlines(userId, from, to),
    ...customEventDeadlines(userId, from, to),
  ]

  events.sort((a, b) => a.date.localeCompare(b.date))
  return events
}
