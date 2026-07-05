// src/lib/investments/fifo.ts — Pure FIFO engine. No I/O, no side effects.
// Monetary amounts: integer minor units (see money.ts).
// Quantities / prices: decimal strings via dec() / Decimal (never Number for math).
import { dec, toMinor, fromMinor, Decimal } from '@/lib/money'
import type { InvestmentTxn } from '@/db/schema'

// ── Internal lot ──────────────────────────────────────────────────────────────

interface Lot {
  remainingQty:    Decimal  // shares / units still unsold
  costBasisMinor:  number   // integer minor units of the original purchase cost
}

// ── Public output types ───────────────────────────────────────────────────────

export interface FifoState {
  remainingQty:       string   // decimal string (as-stored)
  lots:               readonly LotSnapshot[]
  costBasisMinor:     number   // total cost of remaining shares
  realizedPlMinor:    number   // cumulative realised P/L (sell proceeds − cost)
  dividendIncomeMinor: number  // sum of dividend.amount_minor
  feesMinor:          number   // sum of standalone fee.amount_minor
}

export interface LotSnapshot {
  remainingQty:   string  // decimal string
  costBasisMinor: number
}

export interface Position extends FifoState {
  instrumentId:      number
  currency:          string
  symbol:            string
  name:              string
  providerSymbol:    string | null   // CoinGecko coin id (o altro override), null per Yahoo
  lastPrice:         string | null   // decimal string or null if no price cached
  lastPriceAt:       number | null   // epoch seconds or null
  marketValueMinor:  number | null   // null if no price
  unrealizedPlMinor: number | null   // null if no price
  unrealizedPlPct:   string | null   // e.g. "12.34" or null
}

// ── FIFO engine ───────────────────────────────────────────────────────────────

/**
 * Process a chronologically-ordered list of InvestmentTxn for ONE instrument
 * and return the running FIFO state.
 * Throws if txns are for multiple instruments (caller must group first).
 */
export function runFifo(txns: InvestmentTxn[], currency: string): FifoState {
  const lots: Lot[] = []
  let realizedPlMinor    = 0
  let dividendIncomeMinor = 0
  let feesMinor          = 0

  for (const txn of txns) {
    switch (txn.type) {
      case 'buy': {
        if (!txn.quantity || !txn.unit_price) break
        const qty       = dec(txn.quantity)
        const unitPrice = dec(txn.unit_price)
        const grossCost = toMinor(qty.mul(unitPrice).toFixed(2), currency)
        lots.push({ remainingQty: qty, costBasisMinor: grossCost })
        feesMinor += txn.fee_minor   // commissioni tracciate a parte, non nel prezzo di carico
        break
      }

      case 'sell': {
        if (!txn.quantity || !txn.unit_price) break
        let qtyToSell   = dec(txn.quantity)
        const unitPrice = dec(txn.unit_price)
        const proceeds  = toMinor(qtyToSell.mul(unitPrice).toFixed(2), currency) - txn.fee_minor
        let costConsumed = 0

        for (const lot of lots) {
          if (qtyToSell.lte(0)) break
          if (lot.remainingQty.lte(0)) continue

          const consumed = Decimal.min(lot.remainingQty, qtyToSell)
          // proportional cost: consumed / remainingQty × costBasis
          const proportion = consumed.div(lot.remainingQty)
          const lotCostConsumed = Math.round(proportion.mul(lot.costBasisMinor).toNumber())
          costConsumed      += lotCostConsumed
          lot.costBasisMinor -= lotCostConsumed
          lot.remainingQty   = lot.remainingQty.minus(consumed)
          qtyToSell          = qtyToSell.minus(consumed)
        }

        realizedPlMinor += proceeds - costConsumed
        break
      }

      case 'dividend': {
        dividendIncomeMinor += txn.amount_minor ?? 0
        break
      }

      case 'fee': {
        feesMinor += txn.amount_minor ?? 0
        break
      }
    }
  }

  // Aggregate remaining lots
  const activeLots = lots.filter((l) => l.remainingQty.gt(0))
  const totalCostBasis = activeLots.reduce((s, l) => s + l.costBasisMinor, 0)
  const totalQty = activeLots.reduce((s, l) => s.plus(l.remainingQty), dec('0'))

  return {
    remainingQty:        totalQty.toFixed(8).replace(/\.?0+$/, '') || '0',
    lots:                activeLots.map((l) => ({
      remainingQty:   l.remainingQty.toFixed(8).replace(/\.?0+$/, ''),
      costBasisMinor: l.costBasisMinor,
    })),
    costBasisMinor:      totalCostBasis,
    realizedPlMinor,
    dividendIncomeMinor,
    feesMinor,
  }
}

/**
 * Enrich a FifoState with market-value and unrealised P/L given the current price.
 */
export function computePosition(
  instrument: { id: number; symbol: string; name: string; currency: string; provider_symbol: string | null; last_price: string | null; last_price_at: number | null },
  state: FifoState,
): Position {
  let marketValueMinor: number | null  = null
  let unrealizedPlMinor: number | null = null
  let unrealizedPlPct: string | null   = null

  if (instrument.last_price && dec(state.remainingQty).gt(0)) {
    const mv = toMinor(
      dec(state.remainingQty).mul(dec(instrument.last_price)).toFixed(2),
      instrument.currency,
    )
    marketValueMinor  = mv
    unrealizedPlMinor = mv - state.costBasisMinor

    if (state.costBasisMinor !== 0) {
      unrealizedPlPct = dec(unrealizedPlMinor)
        .div(dec(state.costBasisMinor))
        .mul(100)
        .toFixed(2)
    }
  }

  return {
    ...state,
    instrumentId:      instrument.id,
    currency:          instrument.currency,
    symbol:            instrument.symbol,
    name:              instrument.name,
    providerSymbol:    instrument.provider_symbol,
    lastPrice:         instrument.last_price,
    lastPriceAt:       instrument.last_price_at,
    marketValueMinor,
    unrealizedPlMinor,
    unrealizedPlPct,
  }
}
