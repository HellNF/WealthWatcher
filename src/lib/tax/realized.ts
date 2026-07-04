// src/lib/tax/realized.ts — Compute realized sale events from FIFO state.
// Pure function, no I/O. Used as the foundation for wallet.ts and taxSim.ts.
import { dec, toMinor, Decimal } from '@/lib/money'
import type { InvestmentTxn } from '@/db/schema'

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * One realized sale event derived from processing a sell transaction via FIFO.
 * `grossGainMinor` is signed: positive = plusvalenza, negative = minusvalenza.
 */
export interface RealizedSaleEvent {
  date:            string   // ISO YYYY-MM-DD (trade_date of the sell txn)
  grossGainMinor:  number   // proceeds − cost basis consumed (signed)
  cluster:         string   // instrument cluster ('etf' | 'bond' | 'stock' | 'crypto' | 'other')
  currency:        string   // instrument trading currency
}

// ── Internal working lot ──────────────────────────────────────────────────────

interface WorkingLot {
  remainingQty:    Decimal
  costBasisMinor:  number
}

// ── Engine ────────────────────────────────────────────────────────────────────

/**
 * Replay all buy/sell transactions for ONE instrument (already sorted chronologically)
 * and emit a RealizedSaleEvent for each sell transaction.
 *
 * This reuses the FIFO logic but emits per-sell events rather than a final state,
 * giving wallet.ts the date-stamped history it needs to build the fiscal wallet.
 *
 * Fees on buy are included in cost basis; fees on sell reduce proceeds.
 *
 * @param txns   - Chronologically ordered investment_txns for a single instrument
 * @param cluster - The instrument's cluster string
 * @param currency - The instrument's trading currency (ISO-4217)
 */
export function realizedSaleEvents(
  txns: InvestmentTxn[],
  cluster: string,
  currency: string,
): RealizedSaleEvent[] {
  const lots: WorkingLot[] = []
  const events: RealizedSaleEvent[] = []

  for (const txn of txns) {
    if (txn.type === 'buy') {
      if (!txn.quantity || !txn.unit_price) continue
      const qty       = dec(txn.quantity)
      const grossCost = toMinor(qty.mul(dec(txn.unit_price)).toFixed(2), currency)
      lots.push({
        remainingQty:   qty,
        costBasisMinor: grossCost + txn.fee_minor,
      })
    } else if (txn.type === 'sell') {
      if (!txn.quantity || !txn.unit_price) continue

      let qtyToSell    = dec(txn.quantity)
      const proceeds   = toMinor(qtyToSell.mul(dec(txn.unit_price)).toFixed(2), currency) - txn.fee_minor
      let costConsumed = 0

      for (const lot of lots) {
        if (qtyToSell.lte(0)) break
        if (lot.remainingQty.lte(0)) continue

        const consumed       = Decimal.min(lot.remainingQty, qtyToSell)
        const proportion     = consumed.div(lot.remainingQty)
        const lotCost        = Math.round(proportion.mul(lot.costBasisMinor).toNumber())
        costConsumed        += lotCost
        lot.costBasisMinor  -= lotCost
        lot.remainingQty     = lot.remainingQty.minus(consumed)
        qtyToSell            = qtyToSell.minus(consumed)
      }

      events.push({
        date:           txn.trade_date,
        grossGainMinor: proceeds - costConsumed,
        cluster,
        currency,
      })
    }
    // dividend and fee txns do not generate capital gain events
  }

  return events
}
