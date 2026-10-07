// src/lib/marketOverview/eurostat.ts — Inflazione armonizzata (HICP) da
// Eurostat, l'ufficio statistico dell'UE: è la fonte primaria del dato che la
// BCE usa come obiettivo (2%). Dataset `prc_hicp_minr` (classificazione ECOICOP
// v2, in vigore dal 2026): il vecchio dataset — e la serie ICP del portale BCE
// che ne derivava — si è fermato a dicembre 2025.
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'
import type { Observation } from './bonds'

const ROOT = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_minr'

export type HicpGeo = 'EA' | 'IT'
/** TOTAL = indice generale; TOT_X_NRG_FOOD = "core" (senza energia e alimentari). */
export type HicpItem = 'TOTAL' | 'TOT_X_NRG_FOOD'

interface JsonStat {
  value?:     Record<string, number>
  dimension?: { time?: { category?: { index?: Record<string, number> } } }
}

/** Estrae la serie da una risposta JSON-stat a una sola serie (indice = posizione temporale). */
export function parseJsonStatSeries(json: JsonStat): Observation[] {
  const timeIndex = json.dimension?.time?.category?.index
  const values = json.value
  if (!timeIndex || !values) return []
  const out: Observation[] = []
  for (const [period, i] of Object.entries(timeIndex)) {
    const v = values[String(i)]
    if (typeof v === 'number' && Number.isFinite(v)) out.push({ period, value: v })
  }
  out.sort((a, b) => a.period.localeCompare(b.period))
  return out
}

/** Variazione annua % dell'HICP, mensile, dal 2015. [] su errore (loggato). */
export async function fetchHicpAnnualRate(geo: HicpGeo, item: HicpItem = 'TOTAL'): Promise<Observation[]> {
  const url = `${ROOT}?format=JSON&geo=${geo}&unit=RCH_A&coicop18=${item}&sinceTimePeriod=2015-01`
  try {
    const res = await fetchWithTimeout(url, { cache: 'no-store' }, 20_000)
    if (!res.ok) {
      console.warn(`[market] Eurostat HICP ${geo}/${item} → HTTP ${res.status}`)
      return []
    }
    const obs = parseJsonStatSeries(await res.json() as JsonStat)
    if (obs.length === 0) console.warn(`[market] Eurostat HICP ${geo}/${item}: risposta senza osservazioni`)
    return obs
  } catch (e) {
    console.warn(`[market] Eurostat HICP ${geo}/${item} errore di rete:`, e instanceof Error ? e.message : e)
    return []
  }
}
