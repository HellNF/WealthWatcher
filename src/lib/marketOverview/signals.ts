// src/lib/marketOverview/signals.ts — Tipi condivisi e classificatore basato
// su regole trasparenti per la pagina "Panorama Mercati".
//
// Principio (requisito utente): nessun insight "a caso" e nessun verdetto
// prescrittivo "compra/vendi". Ogni segnale è un DATO REALE contestualizzato
// sul proprio storico, mappato su un'etichetta neutra tramite SOGLIE FISSE e
// documentate qui sotto — mai un'opinione. La UI mostra sempre valore +
// percentile + finestra + fonte + data.

/** Direzione dell'etichetta rispetto allo storico. Neutra, non prescrittiva. */
export type SignalLevel = 'low' | 'normal' | 'high'

/** Punto della serie storica mostrata nel grafico. */
export interface SeriesPoint {
  t: string  // etichetta temporale: ISO 'YYYY-MM-DD' o 'YYYY-MM'
  v: number  // valore
}

/** Un singolo indicatore di mercato, serializzato in market_indicators.payload. */
export interface MarketSignal {
  code:       string         // id stabile, es. 'commodities.gold'
  title:      string         // etichetta leggibile, es. 'Oro'
  value:      number         // valore corrente
  unit:       string         // '%', '$', 'pt', '' …
  percentile: number | null  // 0–100 rispetto alla finestra storica; null se non calcolabile
  window:     string         // finestra dichiarata, es. '10 anni'
  level:      SignalLevel | null
  levelText:  string         // testo descrittivo (IT), es. 'storicamente elevato'
  source:     string         // fonte dichiarata, es. 'Yahoo Finance'
  asOf:       number         // unix epoch del dato sottostante
  estimated?: boolean        // true se da fonte di fallback / meno affidabile
  // Serie storica downsampled per il grafico che SPIEGA l'etichetta finale
  // (il lettore vede da dove nasce il percentile/verdetto). Assente per i dati
  // puntuali (es. dominance BTC) che non hanno una storia da mostrare.
  series?:      SeriesPoint[]
  // Frase che spiega, in parole, cosa nel grafico porta all'etichetta.
  explanation?: string
}

// Massimo numero di punti conservati per la serie del grafico: abbastanza per
// una linea leggibile, senza gonfiare il payload JSON in cache.
const MAX_SERIES_POINTS = 120

/**
 * Riduce una serie a al più `max` punti campionando a passo costante e
 * preservando sempre l'ultimo (il valore corrente mostrato dal grafico).
 */
export function downsample(points: SeriesPoint[], max = MAX_SERIES_POINTS): SeriesPoint[] {
  if (points.length <= max) return points
  const step = points.length / max
  const out: SeriesPoint[] = []
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * step)])
  const last = points[points.length - 1]
  if (out[out.length - 1].t !== last.t) out.push(last)
  return out
}

/**
 * Percentile del valore corrente rispetto a una serie storica: frazione di
 * osservazioni storiche ≤ value, in [0,100]. Ritorna null se la storia è vuota
 * (nessun crash, nessuna etichetta inventata su zero dati).
 */
export function percentileOf(value: number, history: number[]): number | null {
  const clean = history.filter((n) => Number.isFinite(n))
  if (clean.length === 0) return null
  const countLoE = clean.reduce((n, h) => (h <= value ? n + 1 : n), 0)
  return (countLoE / clean.length) * 100
}

// Soglie fisse e revisionabili. Volutamente conservative: si etichetta "estremo"
// solo agli estremi della distribuzione storica.
export const HIGH_PERCENTILE = 90
export const LOW_PERCENTILE = 10

/** Mappa un percentile su un livello neutro tramite le soglie fisse. */
export function levelFromPercentile(
  percentile: number | null,
  bands: { low: number; high: number } = { low: LOW_PERCENTILE, high: HIGH_PERCENTILE },
): SignalLevel | null {
  if (percentile === null) return null
  if (percentile >= bands.high) return 'high'
  if (percentile <= bands.low) return 'low'
  return 'normal'
}

/**
 * Testo descrittivo (IT) del livello, parametrizzato sul dominio così che
 * "high" significhi "rendimenti elevati" per i bond ma "valutazioni elevate"
 * per l'azionario. `noun` è ciò che è alto/basso (es. 'valutazioni', 'prezzo',
 * 'rendimento').
 */
export function levelText(level: SignalLevel | null, noun = 'valore'): string {
  switch (level) {
    case 'high':   return `${capitalize(noun)} storicamente ${feminineOrMasculine(noun, 'elevate', 'elevato')}`
    case 'low':    return `${capitalize(noun)} storicamente ${feminineOrMasculine(noun, 'basse', 'basso')}`
    case 'normal': return `${capitalize(noun)} nella norma storica`
    default:       return 'Contesto storico non disponibile'
  }
}

/**
 * Costruisce un MarketSignal a partire dal valore corrente e dalla serie
 * storica (percorso standard per commodities, yield, indici). L'accordo di
 * genere del testo si basa su `noun`.
 */
export function buildPercentileSignal(params: {
  code:    string
  title:   string
  value:   number
  unit:    string
  history: number[]
  window:  string
  source:  string
  asOf:    number
  noun?:   string
  bands?:  { low: number; high: number }
  estimated?: boolean
  series?: SeriesPoint[]
}): MarketSignal {
  const percentile = percentileOf(params.value, params.history)
  const level = levelFromPercentile(percentile, params.bands)
  const noun = params.noun ?? 'valore'

  // Spiegazione che collega il grafico all'etichetta: il valore corrente è più
  // alto/basso del N% delle rilevazioni della finestra → da qui l'etichetta.
  let explanation: string | undefined
  if (percentile !== null) {
    const p = Math.round(percentile)
    explanation =
      p >= 50
        ? `Il ${noun} attuale è più alto del ${p}% delle rilevazioni degli ultimi ${params.window}.`
        : `Il ${noun} attuale è più basso del ${100 - p}% delle rilevazioni degli ultimi ${params.window}.`
  }

  return {
    code:       params.code,
    title:      params.title,
    value:      params.value,
    unit:       params.unit,
    percentile: percentile === null ? null : round1(percentile),
    window:     params.window,
    level,
    levelText:  levelText(level, noun),
    source:     params.source,
    asOf:       params.asOf,
    ...(params.estimated ? { estimated: true } : {}),
    ...(params.series ? { series: downsample(params.series) } : {}),
    ...(explanation ? { explanation } : {}),
  }
}

// ── helper interni ────────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s
}

// Accordo di genere rudimentale ma sufficiente per i pochi sostantivi usati
// (valutazioni/valore/prezzo/rendimento): se termina in 'e'/'i' plurale-femm.
// noto lo trattiamo come femminile plurale. Lista chiusa per evitare sorprese.
const FEMININE_PLURAL = new Set(['valutazioni', 'quotazioni'])
function feminineOrMasculine(noun: string, fem: string, masc: string): string {
  return FEMININE_PLURAL.has(noun.toLowerCase()) ? fem : masc
}
