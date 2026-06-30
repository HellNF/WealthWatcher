'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import { getPortfolioForUser } from '@/lib/portfolios'
import { getOrCreateInstrument } from '@/lib/instruments'
import { insertTxn, deleteTxn } from '@/lib/investmentTxns'
import { refreshPortfolioPrices } from '@/lib/prices'
import { lookupIsin, type IsinResult } from '@/lib/isin'
import { toMinor } from '@/lib/money'

export type ActionState = { error?: string } | undefined

const CLUSTER_VALUES = ['etf', 'bond', 'stock', 'crypto', 'other'] as const
const SOURCE_VALUES  = ['yahoo', 'coingecko', 'alphavantage', 'manual'] as const

const txnSchema = z.object({
  type:            z.enum(['buy', 'sell', 'dividend', 'fee']),
  trade_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida (YYYY-MM-DD)'),
  symbol:          z.string().trim().min(1).toUpperCase(),
  instrument_name: z.string().trim().min(1, 'Nome strumento obbligatorio').max(200),
  cluster:         z.enum(CLUSTER_VALUES),
  currency:        z.string().trim().length(3).toUpperCase(),
  price_source:    z.enum(SOURCE_VALUES).default('yahoo'),
  isin:            z.string().trim().optional(),
  // buy/sell — normalize Italian comma decimal separator at parse time
  quantity:        z.string().trim().transform((v) => v.replace(',', '.')).optional(),
  unit_price:      z.string().trim().transform((v) => v.replace(',', '.')).optional(),
  fee:             z.string().trim().transform((v) => v.replace(',', '.')).optional(),
  // dividend/fee
  amount:          z.string().trim().transform((v) => v.replace(',', '.')).optional(),
  note:            z.string().trim().optional(),
})

export async function addTxnAction(
  portfolioId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()

  const raw = {
    type:            formData.get('type'),
    trade_date:      formData.get('trade_date'),
    symbol:          formData.get('symbol'),
    instrument_name: formData.get('instrument_name'),
    cluster:         formData.get('cluster'),
    currency:        formData.get('currency'),
    price_source:    formData.get('price_source') || 'yahoo',
    isin:            formData.get('isin') || undefined,
    quantity:        formData.get('quantity') || undefined,
    unit_price:      formData.get('unit_price') || undefined,
    fee:             formData.get('fee') || undefined,
    amount:          formData.get('amount') || undefined,
    note:            formData.get('note') || undefined,
  }

  const parsed = txnSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi' }
  }

  const d = parsed.data

  try {
    // Upsert the instrument (creates it if new, returns existing if symbol known)
    const instrument = getOrCreateInstrument({
      symbol:       d.symbol,
      name:         d.instrument_name,
      cluster:      d.cluster,
      currency:     d.currency,
      price_source: d.price_source,
      isin:         d.isin ?? null,
    })

    // Convert fee string to minor units
    const fee_minor = d.fee ? toMinor(d.fee, d.currency) : 0
    // Convert dividend/standalone-fee amount to minor units
    const amount_minor = d.amount ? toMinor(d.amount, d.currency) : null

    await insertTxn(user.id, portfolioId, {
      instrument_id: instrument.id,
      type:          d.type,
      trade_date:    d.trade_date,
      quantity:      d.quantity ?? null,
      unit_price:    d.unit_price ?? null,
      fee_minor,
      amount_minor,
      currency:      d.currency,
      note:          d.note ?? null,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Errore durante il salvataggio' }
  }

  revalidatePath(`/dashboard/portfolios/${portfolioId}`)
  return undefined
}

export async function deleteTxnAction(
  portfolioId: number,
  txnId: number,
): Promise<void> {
  const user = await requireUser()
  deleteTxn(user.id, txnId)
  revalidatePath(`/dashboard/portfolios/${portfolioId}`)
}

export async function lookupIsinAction(isin: string): Promise<IsinResult[]> {
  await requireUser()
  return lookupIsin(isin)
}

export async function refreshPricesAction(portfolioId: number): Promise<void> {
  const user = await requireUser()
  const portfolio = getPortfolioForUser(user.id, portfolioId)
  if (!portfolio) return
  await refreshPortfolioPrices(user.id, portfolioId)
  revalidatePath(`/dashboard/portfolios/${portfolioId}`)
}
