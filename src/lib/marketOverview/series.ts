// src/lib/marketOverview/series.ts — Serie storiche dei grafici, SU RICHIESTA.
//
// Le serie non stanno nel database: in cache ci sono solo i numeri calcolati
// (valutazioni, percentili, rendimenti). Quando l'utente apre un gruppo di
// grafici, la serie viene scaricata dalla fonte in quel momento e tenuta in
// memoria per qualche ora, così aperture successive sono immediate e le fonti
// non vengono interrogate a ogni click. Al riavvio del server la memoria si
// svuota: nessun dato storico viene mai persistito.
//
// Ogni gruppo riusa gli stessi adapter del refresh: un grafico mostra sempre
// la serie da cui è nato il numero che spiega.
import { getEquitySignals } from './equities'
import { getBondSignals } from './bonds'
import { getCommoditySignals } from './commodities'
import { getCryptoSignals } from './crypto'
import { fetchShiller } from './shiller'
import { buildEquityEvidence, capeSignal } from './evidence'
import { MACRO_THEME_BUILDERS, type MacroThemeKey } from './macro'
import type { MarketSignal, SeriesPoint } from './signals'

export type SeriesMap = Record<string, SeriesPoint[]>

const fromSignals = (signals: MarketSignal[]): SeriesMap =>
  Object.fromEntries(signals.filter((s) => s.series && s.series.length > 1).map((s) => [s.code, s.series!]))

async function equitiesGroup(): Promise<SeriesMap> {
  const [signals, shiller] = await Promise.all([getEquitySignals(), fetchShiller()])
  const evidence = shiller ? buildEquityEvidence(shiller) : null
  return fromSignals(evidence ? [...signals, capeSignal(evidence)] : signals)
}

function macroGroup(key: MacroThemeKey): () => Promise<SeriesMap> {
  return async () => {
    const theme = await MACRO_THEME_BUILDERS[key]()
    return Object.fromEntries((theme?.indicators ?? []).filter((i) => i.series && i.series.length > 1).map((i) => [i.code, i.series!]))
  }
}

const GROUPS: Record<string, () => Promise<SeriesMap>> = {
  equities:    equitiesGroup,
  bonds:       async () => fromSignals(await getBondSignals()),
  commodities: async () => fromSignals(await getCommoditySignals()),
  crypto:      async () => fromSignals(await getCryptoSignals()),
  ...Object.fromEntries((Object.keys(MACRO_THEME_BUILDERS) as MacroThemeKey[]).map((k) => [`macro.${k}`, macroGroup(k)])),
}

export function isSeriesGroup(group: string): boolean {
  return Object.hasOwn(GROUPS, group)
}

const TTL_MS = 6 * 3600_000
const memory = new Map<string, { at: number; data: SeriesMap }>()
const inFlight = new Map<string, Promise<SeriesMap | null>>()

/**
 * Serie di un gruppo di grafici. Null se la fonte non ha restituito nulla
 * (l'errore è loggato dagli adapter): un esito vuoto NON viene memorizzato,
 * così il tentativo successivo riprova.
 */
export function getSeriesGroup(group: string): Promise<SeriesMap | null> {
  if (!isSeriesGroup(group)) return Promise.resolve(null)
  const hit = memory.get(group)
  if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.data)

  let pending = inFlight.get(group)
  if (!pending) {
    pending = GROUPS[group]()
      .then((data) => {
        if (Object.keys(data).length === 0) return null
        memory.set(group, { at: Date.now(), data })
        return data
      })
      .catch((e) => {
        console.error(`[market] serie "${group}" non disponibili:`, e)
        return null
      })
      .finally(() => inFlight.delete(group))
    inFlight.set(group, pending)
  }
  return pending
}
