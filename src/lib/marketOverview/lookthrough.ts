// src/lib/marketOverview/lookthrough.ts — "Guardare dentro i fondi". La
// composizione per tipo di strumento (allocation.ts) tratta ogni ETF/fondo come
// un blocco unico: un fondo bilanciato 50/50 e un ETF 100% azionario finiscono
// entrambi sotto "ETF". Qui ogni fondo viene scomposto in ciò che contiene
// davvero (azioni, obbligazioni, liquidità) per ottenere l'ESPOSIZIONE EFFETTIVA
// del portafoglio, che è ciò che va confrontato col contesto di mercato.
//
// La composizione dei fondi è globale (uguale per tutti gli utenti) e viene
// scaricata dal job di refresh; qui il calcolo è puro.
import { sqlite } from '@/db'
import { listInstruments } from '@/lib/instruments'
import { getFundBreakdown, type FundBreakdown } from '@/lib/prices/yahoo'
import type { ValuedPosition } from './allocation'

/** Composizione dei fondi per id strumento. */
export type Lookthrough = Record<number, FundBreakdown>

export type ExposureClass = 'equity' | 'bond' | 'crypto' | 'cash' | 'other' | 'unknown'

export interface ExposureSlice {
  key:           ExposureClass
  valueEurMinor: number
  pct:           number   // 0–100 sul totale valorizzato
}

export interface SectorSlice {
  key: string             // chiave settore Yahoo, es. 'technology'
  pct: number             // 0–100 sulla sola parte azionaria di cui si conosce il settore
}

export interface ExposureResult {
  slices:       ExposureSlice[]
  sectors:      SectorSlice[]
  /** true se almeno un fondo è stato effettivamente scomposto (altrimenti il confronto con i cluster è inutile). */
  hasLookthrough: boolean
}

const ORDER: ExposureClass[] = ['equity', 'bond', 'crypto', 'cash', 'other', 'unknown']

/**
 * Esposizione effettiva: azioni e obbligazioni dirette contano per intero, ogni
 * fondo viene ripartito secondo la sua composizione. Un fondo senza composizione
 * nota finisce in `unknown` — mai assegnato d'ufficio all'azionario.
 */
export function computeExposure(positions: ValuedPosition[], lookthrough: Lookthrough): ExposureResult {
  const totals = new Map<ExposureClass, number>()
  const sectorTotals = new Map<string, number>()
  const add = (k: ExposureClass, v: number) => totals.set(k, (totals.get(k) ?? 0) + v)
  let hasLookthrough = false

  for (const p of positions) {
    if (p.cluster === 'stock')  { add('equity', p.valueEurMinor); continue }
    if (p.cluster === 'bond')   { add('bond', p.valueEurMinor); continue }
    if (p.cluster === 'crypto') { add('crypto', p.valueEurMinor); continue }
    if (p.cluster === 'other')  { add('other', p.valueEurMinor); continue }

    const b = lookthrough[p.instrumentId]
    if (!b) { add('unknown', p.valueEurMinor); continue }
    hasLookthrough = true
    const sum = b.stock + b.bond + b.cash + b.other
    const equity = p.valueEurMinor * (b.stock / sum)
    add('equity', equity)
    add('bond', p.valueEurMinor * (b.bond / sum))
    add('cash', p.valueEurMinor * (b.cash / sum))
    add('other', p.valueEurMinor * (b.other / sum))

    const sectorSum = Object.values(b.sectors).reduce((s, v) => s + v, 0)
    if (sectorSum > 0) {
      for (const [k, w] of Object.entries(b.sectors)) sectorTotals.set(k, (sectorTotals.get(k) ?? 0) + equity * (w / sectorSum))
    }
  }

  const total = [...totals.values()].reduce((s, v) => s + v, 0)
  const slices = ORDER
    .map((key) => ({ key, valueEurMinor: Math.round(totals.get(key) ?? 0), pct: total > 0 ? ((totals.get(key) ?? 0) / total) * 100 : 0 }))
    .filter((s) => s.pct >= 0.05) // sotto lo 0,05% è polvere di arrotondamento

  const sectorTotal = [...sectorTotals.values()].reduce((s, v) => s + v, 0)
  const sectors = [...sectorTotals.entries()]
    .map(([key, v]) => ({ key, pct: sectorTotal > 0 ? (v / sectorTotal) * 100 : 0 }))
    .filter((s) => s.pct >= 0.5)
    .sort((a, b) => b.pct - a.pct)

  return { slices, sectors, hasLookthrough }
}

export function exposurePct(exposure: ExposureResult, key: ExposureClass): number {
  return exposure.slices.find((s) => s.key === key)?.pct ?? 0
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Scarica la composizione dei fondi/ETF con prezzo Yahoo che compaiono in almeno
 * un portafoglio (gli strumenti censiti ma mai acquistati non servono a nessuno).
 * I fondi per cui Yahoo non espone il dato restano fuori dalla mappa (→ `unknown`).
 */
export async function buildLookthrough(): Promise<{ lookthrough: Lookthrough; requested: number }> {
  const held = new Set(
    (sqlite.prepare('SELECT DISTINCT instrument_id AS id FROM investment_txns').all() as { id: number }[]).map((r) => r.id),
  )
  const funds = listInstruments().filter((i) => held.has(i.id) && i.cluster === 'etf' && i.price_source === 'yahoo')
  const lookthrough: Lookthrough = {}
  for (const f of funds) {
    const b = await getFundBreakdown(f.provider_symbol ?? f.symbol)
    if (b) lookthrough[f.id] = b
    else console.warn(`[market] composizione non disponibile per ${f.symbol} (${f.name})`)
    await sleep(250)
  }
  return { lookthrough, requested: funds.length }
}
