// src/lib/netWorthHistory.ts — Patrimonio netto ricostruito per le date senza
// snapshot (tipicamente prima del primo snapshot salvato).
//
// Gli snapshot (src/lib/valuation.ts) sono rilevazioni vere: calcolate nel
// giorno con i prezzi e i saldi di quel giorno. Questa ricostruzione è invece
// una stima a posteriori dai dati che abbiamo, calcolata su richiesta e mai
// salvata come snapshot:
//
//  • Conti: saldo a una data = saldo di riferimento ± movimenti tra le due date
//    (all'indietro se la data è precedente al riferimento), oppure somma dei
//    movimenti fino alla data se il conto non ha un riferimento. Alla data di
//    oggi coincide con il saldo mostrato altrove nell'app.
//  • Investimenti: quantità FIFO alla data × ultimo prezzo di chiusura salvato,
//    nella valuta dello strumento (oltre MAX_PRICE_AGE_DAYS il punto è
//    incompleto; prima del primo prezzo vale il costo di carico).
//  • Altri beni: ultima valutazione nota alla data, altrimenti la più vecchia
//    (o il valore attuale se il bene non ha valutazioni).
//  • Valute: solo cambi già salvati (nessuna chiamata di rete), non più vecchi
//    di MAX_FX_AGE_DAYS.
//
// `complete` è falso quando manca un prezzo recente o un cambio, o quando un
// conto con saldo di riferimento non ha movimenti così vecchi (il suo saldo di
// apertura è una supposizione): quei punti non vanno usati per misurare
// variazioni. I conti senza alcun movimento sono considerati costanti.
import { sqlite } from '@/db'
import { dec, toMinor, fromMinor } from '@/lib/money'
import { runFifo } from '@/lib/investments/fifo'
import type { InvestmentTxn } from '@/db/schema'

export interface ReconstructedPoint {
  date:                string
  netWorthEurMinor:    number
  accountsEurMinor:    number
  investmentsEurMinor: number
  otherAssetsEurMinor: number
  complete:            boolean
}

const MAX_PRICE_AGE_DAYS = 7
const MAX_FX_AGE_DAYS = 7
const DAY_MS = 86_400_000

const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)

interface AccountRow {
  id: number; currency: string; anchor_balance_minor: number | null; anchor_date: string | null
}

/** Somme cumulate dei movimenti per data, per leggere S(d) = Σ movimenti con data ≤ d. */
class Cumulative {
  private dates: string[] = []
  private sums: number[] = []
  constructor(rows: { booked_date: string; total: number }[]) {
    let running = 0
    for (const r of rows) { running += r.total; this.dates.push(r.booked_date); this.sums.push(running) }
  }
  get first(): string | null { return this.dates[0] ?? null }
  at(date: string): number {
    let lo = 0, hi = this.dates.length - 1, found = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (this.dates[mid] <= date) { found = mid; lo = mid + 1 } else hi = mid - 1
    }
    return found === -1 ? 0 : this.sums[found]
  }
}

/**
 * Patrimonio ricostruito per ogni giorno da `from` a `to` inclusi.
 * Converte in EUR solo con cambi già salvati.
 */
export function reconstructNetWorth(userId: number, from: string, to: string): ReconstructedPoint[] {
  if (from > to) return []

  const fxStmt = sqlite.prepare(
    `SELECT date, rate FROM fx_history WHERE base = 'EUR' AND quote = ? AND date <= ? ORDER BY date DESC LIMIT 1`)
  function toEur(minor: number, currency: string, date: string): number | null {
    if (currency === 'EUR' || minor === 0) return minor
    const row = fxStmt.get(currency, date) as { date: string; rate: string } | undefined
    if (!row || daysBetween(row.date, date) > MAX_FX_AGE_DAYS) return null
    return toMinor(dec(fromMinor(minor, currency)).div(dec(row.rate)).toFixed(10), 'EUR')
  }

  // ── Conti ──
  const accounts = sqlite.prepare(
    'SELECT id, currency, anchor_balance_minor, anchor_date FROM bank_accounts WHERE owner_id = ?',
  ).all(userId) as AccountRow[]
  const flowsStmt = sqlite.prepare(
    `SELECT booked_date, SUM(amount_minor) AS total FROM transactions
     WHERE owner_id = ? AND bank_account_id = ? GROUP BY booked_date ORDER BY booked_date`)
  const accountSeries = accounts.map((a) => ({
    account: a,
    flows: new Cumulative(flowsStmt.all(userId, a.id) as { booked_date: string; total: number }[]),
  }))

  // ── Investimenti ──
  const invTxns = sqlite.prepare(
    `SELECT it.* FROM investment_txns it
     JOIN investment_portfolios p ON p.id = it.portfolio_id
     WHERE p.owner_id = ? ORDER BY it.trade_date, it.id`,
  ).all(userId) as InvestmentTxn[]
  const byInstrument = new Map<number, InvestmentTxn[]>()
  for (const t of invTxns) {
    const list = byInstrument.get(t.instrument_id) ?? []
    list.push(t); byInstrument.set(t.instrument_id, list)
  }
  const instruments = new Map((sqlite.prepare(
    `SELECT id, currency FROM instruments WHERE id IN (${[...byInstrument.keys()].join(',') || 'NULL'})`,
  ).all() as { id: number; currency: string }[]).map((i) => [i.id, i.currency]))
  const priceStmt = sqlite.prepare(
    `SELECT date, price FROM price_history WHERE instrument_id = ? AND currency = ? AND date <= ?
     ORDER BY date DESC LIMIT 1`)

  // ── Altri beni ──
  const assets = sqlite.prepare('SELECT id, value_minor, currency FROM assets WHERE owner_id = ?')
    .all(userId) as { id: number; value_minor: number; currency: string }[]
  const assetValueStmt = sqlite.prepare(
    `SELECT value_minor, currency FROM asset_valuations WHERE asset_id = ? AND date <= ? ORDER BY date DESC LIMIT 1`)
  const firstAssetValueStmt = sqlite.prepare(
    `SELECT value_minor, currency FROM asset_valuations WHERE asset_id = ? ORDER BY date ASC LIMIT 1`)
  // Prima della prima valutazione la stima più vicina è la valutazione più
  // vecchia, non il valore attuale (un veicolo si deprezza).
  const earliestAssetValue = new Map(assets.map((a) => [a.id,
    (firstAssetValueStmt.get(a.id) as { value_minor: number; currency: string } | undefined)
      ?? { value_minor: a.value_minor, currency: a.currency }]))

  const points: ReconstructedPoint[] = []
  for (let date = from; date <= to; date = addDays(date, 1)) {
    let complete = true
    let accountsEur = 0, investmentsEur = 0, otherEur = 0

    for (const { account, flows } of accountSeries) {
      let balance: number
      if (account.anchor_balance_minor !== null && account.anchor_date) {
        balance = account.anchor_balance_minor + flows.at(date) - flows.at(account.anchor_date)
        // Prima del riferimento e prima del primo movimento il saldo di apertura
        // è una supposizione. Un conto senza alcun movimento (si aggiorna solo
        // il saldo) è invece considerato costante: è l'unica informazione che c'è.
        if (date < account.anchor_date && flows.first !== null && date < flows.first) complete = false
      } else {
        balance = flows.at(date)
      }
      const eur = toEur(balance, account.currency, date)
      if (eur === null) complete = false
      else accountsEur += eur
    }

    for (const [instrumentId, txns] of byInstrument) {
      const held = txns.filter((t) => t.trade_date <= date)
      if (held.length === 0) continue
      const currency = instruments.get(instrumentId)
      if (!currency) { complete = false; continue }
      const state = runFifo(held, currency)
      const qty = dec(state.remainingQty)
      if (qty.lte(0)) continue
      const price = priceStmt.get(instrumentId, currency, date) as { date: string; price: string } | undefined
      // Senza un prezzo recente si usa l'ultimo noto, e prima del primo prezzo il
      // costo di carico: un valore a zero disegnerebbe un crollo che non c'è stato.
      if (!price || daysBetween(price.date, date) > MAX_PRICE_AGE_DAYS) complete = false
      const valueMinor = price
        ? toMinor(qty.mul(dec(price.price)).toFixed(2), currency)
        : state.costBasisMinor
      const eur = toEur(valueMinor, currency, date)
      if (eur === null) complete = false
      else investmentsEur += eur
    }

    for (const asset of assets) {
      const valuation = (assetValueStmt.get(asset.id, date) as { value_minor: number; currency: string } | undefined)
        ?? earliestAssetValue.get(asset.id)!
      const eur = toEur(valuation.value_minor, valuation.currency, date)
      if (eur === null) complete = false
      else otherEur += eur
    }

    points.push({
      date,
      netWorthEurMinor:    accountsEur + investmentsEur + otherEur,
      accountsEurMinor:    accountsEur,
      investmentsEurMinor: investmentsEur,
      otherAssetsEurMinor: otherEur,
      complete,
    })
  }
  return points
}

/** Primo giorno con dati da cui ricostruire: il primo movimento bancario o d'investimento. */
export function firstReconstructableDate(userId: number): string | null {
  const row = sqlite.prepare(
    `SELECT MIN(d) AS d FROM (
       SELECT MIN(booked_date) AS d FROM transactions WHERE owner_id = ?
       UNION ALL
       SELECT MIN(it.trade_date) FROM investment_txns it
       JOIN investment_portfolios p ON p.id = it.portfolio_id WHERE p.owner_id = ?
     )`,
  ).get(userId, userId) as { d: string | null }
  return row.d
}

/**
 * Storico prima del primo snapshot: dal primo movimento al giorno precedente
 * il primo snapshot. Vuoto se non ci sono snapshot o dati più vecchi.
 */
export function historyBeforeSnapshots(userId: number, firstSnapshotDate: string | null): ReconstructedPoint[] {
  if (!firstSnapshotDate) return []
  const start = firstReconstructableDate(userId)
  if (!start || start >= firstSnapshotDate) return []
  return reconstructNetWorth(userId, start, addDays(firstSnapshotDate, -1))
}
