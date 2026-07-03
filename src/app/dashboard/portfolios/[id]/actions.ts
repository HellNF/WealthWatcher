'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getPortfolioForUser, updatePortfolio, deletePortfolio } from '@/lib/portfolios'
import { backfillPortfolioHistory, type BackfillResult } from '@/lib/prices/backfill'
import { simulateSaleFifo, type TaxSimResult } from '@/lib/taxSim'
import { getOrCreateInstrument, getInstrument, updateInstrumentKidFields } from '@/lib/instruments'
import { insertTxn, deleteTxn } from '@/lib/investmentTxns'
import { refreshPortfolioPrices } from '@/lib/prices'
import { lookupIsin, type IsinResult } from '@/lib/isin'
import { getInstrumentDetails, getHistoricalPrices, type InstrumentDetails, type PricePoint } from '@/lib/prices/yahoo'
import { toMinor, dec } from '@/lib/money'
import { getOpenAiKey } from '@/lib/userSettings'
import { extractKidText, extractKidData, type KidExtraction } from '@/lib/kid/extract'
import { takeSnapshot } from '@/lib/valuation'
import { sqlite } from '@/db'

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
  ter:             z.string().trim().transform((v) => v.replace(',', '.')).optional(),
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
    ter:             formData.get('ter') || undefined,
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
      isin:         d.isin  ?? null,
      ter:          d.ter   ?? null,
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

  // Ricalcola snapshot così la dashboard riflette subito il nuovo patrimonio.
  await takeSnapshot(user.id).catch(() => {})
  revalidatePath('/dashboard')
  revalidatePath(`/dashboard/portfolios/${portfolioId}`)
  return undefined
}

export async function deleteTxnAction(
  portfolioId: number,
  txnId: number,
): Promise<void> {
  const user = await requireUser()
  deleteTxn(user.id, txnId)
  await takeSnapshot(user.id).catch(() => {})
  revalidatePath('/dashboard')
  revalidatePath(`/dashboard/portfolios/${portfolioId}`)
}

// ── Gestione portafoglio (rinomina, elimina) ──────────────────────────────────

export async function renamePortfolioAction(
  portfolioId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'Nome obbligatorio' }
  if (name.length > 100) return { error: 'Nome troppo lungo' }

  const ok = updatePortfolio(user.id, portfolioId, { name })
  if (!ok) return { error: 'Portafoglio non trovato' }

  revalidatePath(`/dashboard/portfolios/${portfolioId}`)
  return undefined
}

// Elimina il portafoglio e a cascata le sue operazioni. Torna all'istituzione.
export async function deletePortfolioAction(portfolioId: number): Promise<void> {
  const user = await requireUser()
  const portfolio = getPortfolioForUser(user.id, portfolioId)
  const institutionId = portfolio?.institution_id

  deletePortfolio(user.id, portfolioId)

  if (institutionId) {
    revalidatePath(`/dashboard/institutions/${institutionId}`)
    redirect(`/dashboard/institutions/${institutionId}`)
  }
  redirect('/dashboard')
}

export async function lookupIsinAction(isin: string): Promise<IsinResult[]> {
  await requireUser()
  return lookupIsin(isin)
}

export async function fetchInstrumentDetailsAction(symbol: string): Promise<InstrumentDetails> {
  await requireUser()
  return getInstrumentDetails(symbol)
}

export async function refreshPricesAction(portfolioId: number): Promise<void> {
  const user = await requireUser()
  const portfolio = getPortfolioForUser(user.id, portfolioId)
  if (!portfolio) return
  await refreshPortfolioPrices(user.id, portfolioId)
  revalidatePath(`/dashboard/portfolios/${portfolioId}`)
}

const VALID_PERIODS = ['1m', '3m', '6m', '1y', '5y'] as const
type Period = typeof VALID_PERIODS[number]

export async function fetchHistoryAction(symbol: string, period: string): Promise<PricePoint[]> {
  await requireUser()
  if (!VALID_PERIODS.includes(period as Period)) return []
  return getHistoricalPrices(symbol, period as Period)
}

export async function simulateSaleAction(
  portfolioId:      number,
  instrumentId:     number,
  qtyToSell:        number,
  sellPricePerUnit: number,
): Promise<TaxSimResult> {
  const user = await requireUser()
  return simulateSaleFifo(user.id, portfolioId, instrumentId, qtyToSell, sellPricePerUnit)
}

export async function backfillHistoryAction(
  portfolioId: number,
): Promise<{ results: BackfillResult[] } | { error: string }> {
  const user = await requireUser()
  const portfolio = getPortfolioForUser(user.id, portfolioId)
  if (!portfolio) return { error: 'Portafoglio non trovato' }
  try {
    const results = await backfillPortfolioHistory(user.id, portfolioId)
    revalidatePath(`/dashboard/portfolios/${portfolioId}`)
    return { results }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Errore durante il backfill' }
  }
}

// ── KID extraction ────────────────────────────────────────────────────────────

export type KidActionState =
  | { error: string }
  | { data: KidExtraction; model: string }
  | undefined

export async function extractKidAction(
  _prev: KidActionState,
  formData: FormData,
): Promise<KidActionState> {
  const user = await requireUser()

  const apiKey = getOpenAiKey(user.id)
  if (!apiKey) {
    return { error: 'Imposta la tua chiave OpenAI nelle Impostazioni prima di importare un KID' }
  }

  const file = formData.get('kid_pdf')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Seleziona un file PDF' }
  }

  let text: string
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    text = await extractKidText(buffer)
  } catch {
    return { error: 'Impossibile leggere il PDF — verifica che il file non sia corrotto' }
  }

  const result = await extractKidData(text, apiKey)
  if (!result.ok) return { error: result.error }

  return { data: result.data, model: result.model }
}

// ── KID confirm (writes to DB) ────────────────────────────────────────────────

const confirmSchema = z.object({
  // Instrument identification — find-or-create by symbol
  symbol:         z.string().trim().min(1).toUpperCase(),
  instr_name:     z.string().trim().min(1),
  cluster:        z.enum(['etf', 'bond', 'stock', 'crypto', 'other'] as const),
  currency:       z.string().trim().length(3).toUpperCase(),
  // KID audit fields
  filename:       z.string().min(1),
  model:          z.string().min(1),
  extracted_json: z.string().min(1),
  // Reviewed/corrected KID values — empty string treated as null (clear the field)
  name:           z.string().trim().min(1).optional(),
  ter:            z.string().trim().transform(v => v.replace(',', '.') || null).nullable().optional(),
  entry_cost:     z.string().trim().transform(v => v.replace(',', '.') || null).nullable().optional(),
  exit_cost:      z.string().trim().transform(v => v.replace(',', '.') || null).nullable().optional(),
  sri:            z.preprocess(v => v === '' ? null : v, z.coerce.number().int().min(1).max(7).nullable().optional()),
})

export type ConfirmKidState = { error?: string; success?: string } | undefined

export async function confirmKidAction(
  _prev: ConfirmKidState,
  formData: FormData,
): Promise<ConfirmKidState> {
  const user = await requireUser()

  const raw: Record<string, unknown> = {}
  for (const [k, v] of formData.entries()) raw[k] = v

  const parse = confirmSchema.safeParse(raw)
  if (!parse.success) return { error: parse.error.issues[0].message }

  const { symbol, instr_name, cluster, currency, filename, model, extracted_json,
          name, ter, entry_cost, exit_cost, sri } = parse.data

  // Find or create the instrument (idempotent)
  const instr = getOrCreateInstrument({ symbol, name: instr_name, cluster, currency })

  // Update with confirmed KID fields
  updateInstrumentKidFields(instr.id, {
    ...(name       !== undefined ? { name }       : {}),
    ...(ter        !== undefined ? { ter }        : {}),
    ...(entry_cost !== undefined ? { entry_cost } : {}),
    ...(exit_cost  !== undefined ? { exit_cost }  : {}),
    ...(sri        !== undefined ? { sri }        : {}),
  })

  // Audit record
  sqlite.prepare(`
    INSERT INTO kid_documents (owner_id, instrument_id, filename, extracted_json, status, model)
    VALUES (?, ?, ?, ?, 'confirmed', ?)
  `).run(user.id, instr.id, filename, extracted_json, model)

  revalidatePath(`/dashboard/portfolios`, 'page')
  return { success: 'Dati KID salvati correttamente' }
}
