// src/lib/tax/annual.ts — Aggregatore annuale plus/minusvalenze realizzate e imposta dovuta.
// Derivato a runtime: nessuna tabella persistita.
//
// Normativa:
//  - Art. 67–68 TUIR: plusvalenze su azioni, bond, ETF, cripto = imposta sostitutiva 26%
//  - ETF in guadagno = reddito di capitale (non compensa lo zainetto)
//  - ETF in perdita  = reddito diverso (genera credito nello zainetto, 4 anni)
//  - Cripto: franchigia €2.000 annua (Art. 67 c. 1 lett. c-sexies TUIR)
//  - Compensazione: art. 68 TUIR, FIFO per scadenza
import { sqlite } from '@/db'
import { convertToEur } from '@/lib/fx/convert'
import { realizedSaleEvents } from './realized'
import { computeFiscalWallet, simulateOffset } from './wallet'
import { syntheticRate, incomeType, CRYPTO_FRANCHIGIA_EUR_MINOR } from './rates'
import type { InvestmentTxn } from '@/db/schema'

// ── Tipi interni ──────────────────────────────────────────────────────────────

interface TxnRow {
  type:         'buy' | 'sell' | 'dividend' | 'fee'
  trade_date:   string
  quantity:     string | null
  unit_price:   string | null
  fee_minor:    number
  amount_minor: number | null
  currency:     string
  instrument_id: number
}

interface InstrumentRow {
  id:                   number
  name:                 string
  cluster:              string
  whitelist_percentage: string
  currency:             string
}

// ── Tipi pubblici ─────────────────────────────────────────────────────────────

/**
 * Un singolo evento fiscale realizzato nell'anno: una vendita (o parte di vendita FIFO)
 * con il suo impatto fiscale stimato.
 */
export interface RealizedTaxEvent {
  date:           string                    // ISO YYYY-MM-DD
  instrumentName: string
  cluster:        string
  gainEurMinor:   number                    // firmato: >0 plus, <0 minus, in EUR minor
  incomeType:     'diverse' | 'capitale'
  appliedRate:    number                    // aliquota sintetica (0.26, 0.125 o mista)
  taxMinor:       number                    // imposta dovuta su questo evento (0 per minus)
}

/**
 * Riepilogo fiscale annuale: plus/minus realizzate, compensazione zainetto, imposta totale.
 */
export interface RealizedYearTax {
  year:               string
  events:             RealizedTaxEvent[]
  /** Σ plusvalenze tassabili (>0) in EUR, pre-compensazione */
  grossGainMinor:     number
  /** Σ minusvalenze in valore assoluto, in EUR */
  lossMinor:          number
  /** Credito zainetto consumato per compensare plus 'diverse' */
  compensatedMinor:   number
  /** Plusvalenze crypto totali (per franchigia) */
  cryptoGainMinor:    number
  /** true se plusvalenze crypto ≤ €2.000 (franchigia, nessuna imposta) */
  cryptoExempt:       boolean
  /** Imposta effettiva stimata dopo compensazione e franchigia */
  totalTaxDueMinor:   number
  /** true se conversione FX mancante per almeno un evento */
  stale:              boolean
}

// ── Funzione principale ───────────────────────────────────────────────────────

/**
 * Calcola le plus/minusvalenze realizzate nell'anno per tutti i portafogli dell'utente
 * e stima l'imposta dovuta, applicando la compensazione con lo zainetto fiscale e
 * la franchigia cripto.
 *
 * La compensazione è basata sul wallet CORRENTE (accurata per l'anno in corso;
 * per anni passati è una stima informativa, in quanto il wallet riflette anche
 * le transazioni successive).
 *
 * Nessun catch{} vuoto: FX mancante → stale = true (mai errore silenzioso).
 */
export async function realizedTaxForYear(userId: number, year: string): Promise<RealizedYearTax> {
  const today = new Date().toISOString().slice(0, 10)
  const yearEnd = `${year}-12-31`

  // 1. Carica txns buy/sell fino alla fine dell'anno (FIFO richiede l'intera storia)
  const txnRows = sqlite.prepare(`
    SELECT t.type, t.trade_date, t.quantity, t.unit_price, t.fee_minor,
           t.amount_minor, t.currency, t.instrument_id
    FROM investment_txns t
    WHERE t.owner_id = ?
      AND t.type IN ('buy', 'sell')
      AND t.quantity IS NOT NULL
      AND t.unit_price IS NOT NULL
      AND t.trade_date <= ?
    ORDER BY t.trade_date ASC, t.id ASC
  `).all(userId, yearEnd) as TxnRow[]

  if (txnRows.length === 0) {
    return {
      year, events: [], grossGainMinor: 0, lossMinor: 0,
      compensatedMinor: 0, cryptoGainMinor: 0, cryptoExempt: false,
      totalTaxDueMinor: 0, stale: false,
    }
  }

  // 2. Metadata strumenti
  const instrumentIds = [...new Set(txnRows.map(r => r.instrument_id))]
  const instrRows = sqlite.prepare(
    `SELECT id, name, cluster, whitelist_percentage, currency
     FROM instruments WHERE id IN (${instrumentIds.map(() => '?').join(',')})`,
  ).all(...instrumentIds) as InstrumentRow[]
  const instrMap = new Map(instrRows.map(r => [r.id, r]))

  // 3. Raggruppa per strumento
  const byInstrument = new Map<number, TxnRow[]>()
  for (const row of txnRows) {
    const list = byInstrument.get(row.instrument_id) ?? []
    list.push(row)
    byInstrument.set(row.instrument_id, list)
  }

  const rawEvents: (RealizedTaxEvent & { _instrCurrency: string })[] = []
  let anyStale = false

  for (const [instrId, rows] of byInstrument) {
    const instr = instrMap.get(instrId)
    if (!instr) continue

    const txnsForFifo = rows.map(r => ({
      ...r,
      id:           0,
      owner_id:     userId,
      portfolio_id: 0,
      note:         null,
      created_at:   0,
    })) as InvestmentTxn[]

    const saleEvents = realizedSaleEvents(txnsForFifo, instr.cluster, instr.currency)

    // Filtra per anno target
    for (const ev of saleEvents) {
      if (!ev.date.startsWith(year)) continue

      // Converti in EUR
      let gainEurMinor: number
      if (instr.currency === 'EUR') {
        gainEurMinor = ev.grossGainMinor
      } else {
        // Usa il tasso della data dell'evento (se passato) o il tasso odierno
        const fxDate = ev.date <= today ? ev.date : today
        const converted = await convertToEur(ev.grossGainMinor, instr.currency, fxDate)
        if (converted !== null) {
          gainEurMinor = converted
        } else {
          // Fallback a oggi
          const fallback = await convertToEur(ev.grossGainMinor, instr.currency, today)
          gainEurMinor = fallback ?? ev.grossGainMinor  // ultimo fallback: senza conversione
          anyStale = true
        }
      }

      const itype = incomeType(ev.cluster, ev.grossGainMinor)
      const rate  = syntheticRate(instr.whitelist_percentage)

      rawEvents.push({
        date:           ev.date,
        instrumentName: instr.name,
        cluster:        ev.cluster,
        gainEurMinor,
        incomeType:     itype,
        appliedRate:    rate,
        taxMinor:       0,   // calcolato dopo
        _instrCurrency: instr.currency,
      })
    }
  }

  // Ordina per data
  rawEvents.sort((a, b) => a.date.localeCompare(b.date))

  // 4. Calcola aggregati
  let grossGainMinor  = 0
  let lossMinor       = 0
  let cryptoGainMinor = 0

  for (const ev of rawEvents) {
    if (ev.gainEurMinor > 0) {
      grossGainMinor += ev.gainEurMinor
      if (ev.cluster === 'crypto') cryptoGainMinor += ev.gainEurMinor
    } else if (ev.gainEurMinor < 0) {
      lossMinor += Math.abs(ev.gainEurMinor)
    }
  }

  // Franchigia cripto: se plusvalenze crypto totali ≤ €2.000 → esenti
  const cryptoExempt = cryptoGainMinor > 0 && cryptoGainMinor <= CRYPTO_FRANCHIGIA_EUR_MINOR

  // 5. Compensazione zainetto
  //    Somma le plus 'diverse' tassabili (escluse crypto esenti)
  const totalDiverseGainMinor = rawEvents
    .filter(ev => ev.gainEurMinor > 0 && ev.incomeType === 'diverse' && !(ev.cluster === 'crypto' && cryptoExempt))
    .reduce((s, ev) => s + ev.gainEurMinor, 0)

  const wallet = computeFiscalWallet(userId)
  const { compensatedMinor } = simulateOffset(wallet, totalDiverseGainMinor, yearEnd)

  // 6. Distribuisce la compensazione proporzionalmente agli eventi 'diverse' positivi
  //    e calcola taxMinor per ciascun evento
  let compensationLeft = compensatedMinor
  let totalTaxDueMinor = 0

  const events: RealizedTaxEvent[] = rawEvents.map(ev => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _instrCurrency, ...rest } = ev
    let taxMinor = 0

    if (ev.gainEurMinor <= 0) {
      // Minusvalenza → nessuna imposta
      taxMinor = 0
    } else if (ev.cluster === 'crypto' && cryptoExempt) {
      // Cripto esenti dalla franchigia
      taxMinor = 0
    } else if (ev.incomeType === 'capitale') {
      // ETF in guadagno → tassato, non compensabile
      taxMinor = Math.round(ev.gainEurMinor * ev.appliedRate)
    } else {
      // Reddito diverso → applica compensazione proporzionale
      const usedCompensation = Math.min(compensationLeft, ev.gainEurMinor)
      compensationLeft -= usedCompensation
      const taxableGain = ev.gainEurMinor - usedCompensation
      taxMinor = Math.round(taxableGain * ev.appliedRate)
    }

    totalTaxDueMinor += taxMinor
    return { ...rest, taxMinor }
  })

  return {
    year,
    events,
    grossGainMinor,
    lossMinor,
    compensatedMinor,
    cryptoGainMinor,
    cryptoExempt,
    totalTaxDueMinor,
    stale: anyStale,
  }
}

// ── Anni con attività fiscale ────────────────────────────────────────────────

/**
 * Anni in cui l'utente ha effettuato vendite (per popolare il selettore anno).
 * Comprende sempre l'anno corrente anche se non ci sono vendite.
 * Ordine ASC.
 */
export function taxYears(userId: number): string[] {
  const rows = sqlite.prepare(`
    SELECT DISTINCT substr(trade_date, 1, 4) AS yr
    FROM investment_txns
    WHERE owner_id = ?
      AND type = 'sell'
      AND quantity IS NOT NULL
      AND unit_price IS NOT NULL
    ORDER BY yr ASC
  `).all(userId) as { yr: string }[]

  const years = rows.map(r => r.yr)
  const currentYear = new Date().getFullYear().toString()
  if (!years.includes(currentYear)) years.push(currentYear)
  return years.sort()
}
