// src/lib/taxSim.ts — FIFO tax simulation for Italian capital gains.
// Applies the correct tax rate per asset class (12.5% White List, synthetic ETF rate,
// 26% standard) and compensates gains against the fiscal wallet (zainetto fiscale).
// Pure function: reads investment_txns and instruments, no mutations.
import { dec, toMinor, Decimal } from '@/lib/money'
import { sqlite } from '@/db'
import { effectiveRate, incomeType, cryptoFranchigiaMinor } from '@/lib/tax/rates'
import { computeFiscalWallet, simulateOffset, cryptoRealizedGainForYear } from '@/lib/tax/wallet'
import type { IncomeType } from '@/lib/tax/rates'

export interface SaleLotResult {
  purchaseDate:   string
  qtyConsumed:    number
  costPerUnit:    number  // in currency units (e.g. 98.50, not 9850)
  grossGainMinor: number  // negative = loss
  taxDueMinor:    number  // after compensation and rate application; 0 if loss
  taxCreditMinor: number  // |loss| credit generated (stored in zainetto); 0 if gain
}

export interface TaxSimResult {
  instrumentId:          number
  symbol:                string
  name:                  string
  currency:              string
  cluster:               string
  qtyToSell:             number
  sellPricePerUnit:      number
  lots:                  SaleLotResult[]
  totalGrossGainMinor:   number
  totalTaxDueMinor:      number   // final tax due after wallet compensation
  totalTaxCreditMinor:   number   // new credit generated (if net loss)
  totalNetMinor:         number   // gross − taxDue  (or gross + taxCredit if loss)
  // Enriched fields (new)
  appliedRate:           number   // e.g. 0.26, 0.125, 0.1925 — the synthetic rate used
  incomeType:            IncomeType   // 'diverse' or 'capitale'
  compensatedMinor:      number   // amount of wallet credit consumed by this gain
  taxableAfterCompensationMinor: number  // gain after wallet offset, before applying rate
  // Crypto exemption
  cryptoExempt:          boolean  // true = below €2,000 annual threshold
  cryptoAnnualGainMinor: number   // total crypto gains in current year (incl. this simulation)
  hasData:               boolean
  error?:                string
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
    instrumentId, symbol: '', name: '', currency: '', cluster: '',
    qtyToSell, sellPricePerUnit, lots: [],
    totalGrossGainMinor: 0, totalTaxDueMinor: 0, totalTaxCreditMinor: 0, totalNetMinor: 0,
    appliedRate: 0.26, incomeType: 'diverse', compensatedMinor: 0,
    taxableAfterCompensationMinor: 0,
    cryptoExempt: false, cryptoAnnualGainMinor: 0,
    hasData: false, error,
  })

  const pf = sqlite.prepare(
    `SELECT id FROM investment_portfolios WHERE id = ? AND owner_id = ?`,
  ).get(portfolioId, userId) as { id: number } | undefined
  if (!pf) return empty('Portafoglio non trovato o non autorizzato')

  const instr = sqlite.prepare(
    `SELECT id, symbol, name, currency, cluster, whitelist_percentage FROM instruments WHERE id = ?`,
  ).get(instrumentId) as {
    id: number; symbol: string; name: string; currency: string
    cluster: string; whitelist_percentage: string
  } | undefined
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
        const consumed    = Decimal.min(lot.remainingQty, toConsume)
        const proportion  = consumed.div(lot.remainingQty)
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
  // Anno corrente: la simulazione è "come se vendessi oggi" (aliquota cripto year-aware).
  const yearNum = new Date().getFullYear()
  const rate    = effectiveRate(instr.cluster, instr.whitelist_percentage, yearNum)

  for (const lot of available) {
    if (remaining.lte(1e-10)) break
    const consumed     = Decimal.min(lot.remainingQty, remaining)
    const proportion   = consumed.div(lot.remainingQty)
    const costConsumed = Math.round(proportion.mul(lot.totalCostMinor).toNumber())
    const qtyNum       = consumed.toNumber()
    const costPerUnit  = qtyNum > 0 ? costConsumed / qtyNum / 100 : 0
    const proceeds     = Math.round(qtyNum * sellPricePerUnit * 100)
    const grossGain    = proceeds - costConsumed
    // Per-lot tax is computed without compensation (shown as raw); compensation applied at total level
    simLots.push({
      purchaseDate:   lot.purchaseDate,
      qtyConsumed:    qtyNum,
      costPerUnit,
      grossGainMinor: grossGain,
      taxDueMinor:    grossGain > 0 ? Math.round(grossGain * rate) : 0,
      taxCreditMinor: grossGain < 0 ? Math.abs(grossGain) : 0,
    })
    remaining = remaining.minus(consumed)
  }

  const totalGrossGainMinor = simLots.reduce((s, l) => s + l.grossGainMinor, 0)
  const appliedRate         = rate
  const type                = incomeType(instr.cluster, totalGrossGainMinor)
  const today               = new Date().toISOString().slice(0, 10)

  let totalTaxDueMinor      = 0
  let totalTaxCreditMinor   = 0
  let compensatedMinor      = 0
  let taxableAfter          = 0
  let cryptoExempt          = false
  let cryptoAnnualGain      = 0

  if (totalGrossGainMinor > 0) {
    if (type === 'diverse') {
      // Try to offset with fiscal wallet credits
      const wallet = computeFiscalWallet(userId)
      const { netGainMinor, compensatedMinor: comp } = simulateOffset(wallet, totalGrossGainMinor, today)
      compensatedMinor = comp
      taxableAfter     = netGainMinor

      if (instr.cluster === 'crypto') {
        // Crypto exemption check: sum prior year gains + this gain
        const year     = today.slice(0, 4)
        const priorYearGain = cryptoRealizedGainForYear(userId, year)
        cryptoAnnualGain    = priorYearGain + totalGrossGainMinor
        const franchigia    = cryptoFranchigiaMinor(yearNum)
        if (franchigia > 0 && cryptoAnnualGain <= franchigia) {
          cryptoExempt     = true
          totalTaxDueMinor = 0
        } else {
          // Tax on entire annual gain exceeding threshold (spec: tax on the full amount)
          totalTaxDueMinor = Math.round(taxableAfter * appliedRate)
        }
      } else {
        totalTaxDueMinor = Math.round(taxableAfter * appliedRate)
      }
    } else {
      // reddito di capitale (ETF gain): taxed at synthetic rate, no wallet offset
      taxableAfter     = totalGrossGainMinor
      totalTaxDueMinor = Math.round(totalGrossGainMinor * appliedRate)
    }
  } else if (totalGrossGainMinor < 0) {
    // Loss — generate credit (shown as the raw loss amount)
    totalTaxCreditMinor = Math.abs(totalGrossGainMinor)
  }

  const totalNetMinor = totalGrossGainMinor - totalTaxDueMinor

  return {
    instrumentId, symbol: instr.symbol, name: instr.name, currency: instr.currency,
    cluster: instr.cluster,
    qtyToSell, sellPricePerUnit, lots: simLots,
    totalGrossGainMinor, totalTaxDueMinor, totalTaxCreditMinor, totalNetMinor,
    appliedRate, incomeType: type,
    compensatedMinor, taxableAfterCompensationMinor: taxableAfter,
    cryptoExempt, cryptoAnnualGainMinor: cryptoAnnualGain,
    hasData: true,
  }
}
