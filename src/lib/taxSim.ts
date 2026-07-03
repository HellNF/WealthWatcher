// src/lib/taxSim.ts — FIFO tax simulation for Italian capital gains (imposta sostitutiva 26%).
// Pure function: reads investment_txns, replays FIFO, simulates a future sell.
// No mutations, no side-effects.
import { dec, toMinor, Decimal } from '@/lib/money'
import { sqlite } from '@/db'

const TAX_RATE = 0.26

export interface SaleLotResult {
  purchaseDate:   string
  qtyConsumed:    number
  costPerUnit:    number  // in currency units (e.g. 98.50, not 9850)
  grossGainMinor: number  // negative = loss
  taxDueMinor:    number  // 26% of gain; 0 if loss
  taxCreditMinor: number  // 26% of |loss| as potential future credit; 0 if gain
}

export interface TaxSimResult {
  instrumentId:        number
  symbol:              string
  name:                string
  currency:            string
  qtyToSell:           number
  sellPricePerUnit:    number
  lots:                SaleLotResult[]
  totalGrossGainMinor: number
  totalTaxDueMinor:    number
  totalTaxCreditMinor: number
  totalNetMinor:       number  // gross − taxDue (for gains) or gross + taxCredit (for losses)
  hasData:             boolean
  error?:              string
}

interface WorkingLot {
  purchaseDate:   string
  remainingQty:   Decimal
  totalCostMinor: number
}

export function simulateSaleFifo(
  userId:           number,
  portfolioId:      number,
  instrumentId:     number,
  qtyToSell:        number,
  sellPricePerUnit: number,
): TaxSimResult {
  const empty = (error: string): TaxSimResult => ({
    instrumentId, symbol: '', name: '', currency: '',
    qtyToSell, sellPricePerUnit, lots: [],
    totalGrossGainMinor: 0, totalTaxDueMinor: 0, totalTaxCreditMinor: 0, totalNetMinor: 0,
    hasData: false, error,
  })

  const pf = sqlite.prepare(
    `SELECT id FROM investment_portfolios WHERE id = ? AND owner_id = ?`,
  ).get(portfolioId, userId) as { id: number } | undefined
  if (!pf) return empty('Portafoglio non trovato o non autorizzato')

  const instr = sqlite.prepare(
    `SELECT id, symbol, name, currency FROM instruments WHERE id = ?`,
  ).get(instrumentId) as { id: number; symbol: string; name: string; currency: string } | undefined
  if (!instr) return empty('Strumento non trovato')

  const txns = sqlite.prepare(`
    SELECT type, trade_date, quantity, unit_price, fee_minor
    FROM investment_txns
    WHERE portfolio_id = ? AND instrument_id = ?
      AND type IN ('buy','sell')
      AND quantity IS NOT NULL AND unit_price IS NOT NULL
    ORDER BY trade_date ASC, id ASC
  `).all(portfolioId, instrumentId) as Array<{
    type: 'buy' | 'sell'
    trade_date: string
    quantity: string
    unit_price: string
    fee_minor: number
  }>

  // Replay FIFO to build remaining lots with purchase dates
  const lots: WorkingLot[] = []

  for (const txn of txns) {
    const qty = dec(txn.quantity)
    if (txn.type === 'buy') {
      const grossCost = toMinor(qty.mul(dec(txn.unit_price)).toFixed(2), instr.currency)
      lots.push({
        purchaseDate:   txn.trade_date,
        remainingQty:   qty,
        totalCostMinor: grossCost + txn.fee_minor,
      })
    } else {
      let toConsume = qty
      for (const lot of lots) {
        if (toConsume.lte(0) || lot.remainingQty.lte(0)) continue
        const consumed   = Decimal.min(lot.remainingQty, toConsume)
        const proportion = consumed.div(lot.remainingQty)
        const costConsumed = Math.round(proportion.mul(lot.totalCostMinor).toNumber())
        lot.totalCostMinor -= costConsumed
        lot.remainingQty    = lot.remainingQty.minus(consumed)
        toConsume           = toConsume.minus(consumed)
      }
    }
  }

  const available = lots.filter(l => l.remainingQty.gt(1e-10))
  const totalAvailable = available.reduce((s, l) => s.plus(l.remainingQty), dec('0'))

  if (dec(String(qtyToSell)).gt(totalAvailable.plus(0.0001))) {
    return empty(
      `Quantità insufficiente: disponibili ${totalAvailable.toFixed(6).replace(/\.?0+$/, '')} quote`,
    )
  }

  // Simulate the sell consuming lots FIFO
  const simLots: SaleLotResult[] = []
  let remaining = dec(String(qtyToSell))

  for (const lot of available) {
    if (remaining.lte(1e-10)) break
    const consumed    = Decimal.min(lot.remainingQty, remaining)
    const proportion  = consumed.div(lot.remainingQty)
    const costConsumed = Math.round(proportion.mul(lot.totalCostMinor).toNumber())
    const qtyNum      = consumed.toNumber()
    const costPerUnit = qtyNum > 0 ? costConsumed / qtyNum / 100 : 0
    const proceeds    = Math.round(qtyNum * sellPricePerUnit * 100)
    const grossGain   = proceeds - costConsumed
    simLots.push({
      purchaseDate:   lot.purchaseDate,
      qtyConsumed:    qtyNum,
      costPerUnit,
      grossGainMinor: grossGain,
      taxDueMinor:    grossGain > 0 ? Math.round(grossGain * TAX_RATE) : 0,
      taxCreditMinor: grossGain < 0 ? Math.round(-grossGain * TAX_RATE) : 0,
    })
    remaining = remaining.minus(consumed)
  }

  const totalGrossGainMinor  = simLots.reduce((s, l) => s + l.grossGainMinor, 0)
  const totalTaxDueMinor     = totalGrossGainMinor > 0 ? Math.round(totalGrossGainMinor * TAX_RATE) : 0
  const totalTaxCreditMinor  = totalGrossGainMinor < 0 ? Math.round(-totalGrossGainMinor * TAX_RATE) : 0
  const totalNetMinor        = totalGrossGainMinor - totalTaxDueMinor

  return {
    instrumentId, symbol: instr.symbol, name: instr.name, currency: instr.currency,
    qtyToSell, sellPricePerUnit, lots: simLots,
    totalGrossGainMinor, totalTaxDueMinor, totalTaxCreditMinor, totalNetMinor,
    hasData: true,
  }
}
