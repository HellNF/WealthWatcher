// src/lib/marketOverview/fred.ts — Serie storiche FRED (Federal Reserve Bank of
// St. Louis). Endpoint CSV pubblico e keyless (`fredgraph.csv`): una riga per
// osservazione, "." per i giorni senza dato. Fonte istituzionale per i dati
// macro USA (tassi Fed, Treasury, inflazione, lavoro, stress finanziario).
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'
import type { Observation } from './bonds'

const FRED_CSV = 'https://fred.stlouisfed.org/graph/fredgraph.csv'

/** Parser del CSV FRED: salta intestazione e osservazioni mancanti ("."). */
export function parseFredCsv(csv: string): Observation[] {
  const out: Observation[] = []
  const lines = csv.trim().split('\n')
  for (let i = 1; i < lines.length; i++) {
    const [period, raw] = lines[i].trim().split(',')
    const value = parseFloat(raw)
    if (/^\d{4}-\d{2}-\d{2}$/.test(period ?? '') && Number.isFinite(value)) out.push({ period, value })
  }
  return out
}

/**
 * Scarica una serie FRED da `since` (YYYY-MM-DD) a oggi, ordinata crescente.
 * Ritorna [] su qualsiasi errore, loggandolo (mai lancia, mai tace).
 */
export async function fetchFred(seriesId: string, since: string): Promise<Observation[]> {
  const url = `${FRED_CSV}?id=${encodeURIComponent(seriesId)}&cosd=${since}`
  try {
    const res = await fetchWithTimeout(url, { cache: 'no-store' }, 20_000)
    if (!res.ok) {
      console.warn(`[market] FRED ${seriesId} → HTTP ${res.status}`)
      return []
    }
    const obs = parseFredCsv(await res.text())
    if (obs.length === 0) console.warn(`[market] FRED ${seriesId}: nessuna osservazione valida`)
    return obs
  } catch (e) {
    console.warn(`[market] FRED ${seriesId} errore di rete:`, e instanceof Error ? e.message : e)
    return []
  }
}
