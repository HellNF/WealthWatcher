// src/lib/prices/autoscout24.ts — Stima valore veicolo via scraping della ricerca
// pubblica di AutoScout24.it (nessuna API di valutazione ufficiale disponibile —
// vedi commento in cima a vehicleEstimate.ts).
//
// Verificato manualmente contro il sito reale (luglio 2026): la pagina di ricerca
// è Next.js e incorpora i risultati come JSON nello script <script id="__NEXT_DATA__">
// — niente parsing HTML fragile. Struttura osservata:
//   pageProps.numberOfResults          → conteggio totale annunci
//   pageProps.listings[].price.priceRaw → prezzo intero in EUR
//   pageProps.listings[].vehicle.{make,model,fuel,transmission,mileageInKm,...}
//
// ATTENZIONE: questa è una struttura non documentata e non contrattuale — AutoScout24
// può cambiarla in qualsiasi momento senza preavviso, e lo scraping è in tensione con
// i loro Termini di Servizio. Il parser non lancia MAI eccezioni: qualunque anomalia
// (JSON assente, campo mancante, HTTP non-200) ritorna null, e il chiamante marca la
// stima come "stale" mantenendo l'ultimo valore noto. Un campione insufficiente NON è
// più un'anomalia fatale: vedi cascata di rilassamento sotto.
import type { Quote } from './provider'

const BASE = 'https://www.autoscout24.it'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// Kill-switch operativo: se il sito cambia struttura o inizia a bloccare le
// richieste, si disattiva lo scraping via env senza deploy di codice.
const ENABLED = process.env.AUTOSCOUT_ENABLED !== '0'

// Numero minimo di annunci comparabili per considerare la mediana affidabile.
const MIN_SAMPLE_SIZE = 3

export type FuelType = 'petrol' | 'diesel' | 'electric' | 'hybrid' | 'lpg'
export type GearboxType = 'manual' | 'automatic'
// Mercati coperti dalla ricerca AutoScout24 (taxonomy.country nel loro __NEXT_DATA__).
// I prezzi variano parecchio da un paese all'altro — restringere al mercato giusto
// evita di mischiare comparabili non rappresentativi.
export type Country = 'AT' | 'BE' | 'DE' | 'ES' | 'FR' | 'IT' | 'LU' | 'NL'
// Quanto fidarsi del prezzo trovato: 'high' = match sui filtri principali (anno,
// km, potenza) pressoché intatti; 'low' = filtri allentati parecchio pur di
// raggiungere un campione minimo. Vedi scoreConfidence() più sotto.
export type Confidence = 'high' | 'medium' | 'low'

// Mappatura verso i codici di AutoScout24 (taxonomy.fuelType nel loro __NEXT_DATA__).
const FUEL_CODE: Record<FuelType, string> = {
  petrol:   'B',
  diesel:   'D',
  electric: 'E',
  hybrid:   '2', // "Elettrica/Benzina" — l'ibrido più comune
  lpg:      'L',
}
const GEAR_CODE: Record<GearboxType, string> = {
  manual:    'M',
  automatic: 'A',
}
// Mappatura verso i codici paese di AutoScout24 (taxonomy.country), NON gli ISO alpha-2.
const COUNTRY_CODE: Record<Country, string> = {
  AT: 'A', BE: 'B', DE: 'D', ES: 'E', FR: 'F', IT: 'I', LU: 'L', NL: 'NL',
}
export interface VehicleQuery {
  make:            string
  model:           string
  year:            number
  fuel?:           FuelType | null
  gearbox?:        GearboxType | null
  powerHp?:        number | null   // potenza in CV — restringe i comparabili alla stessa fascia
  displacementCc?: number | null   // cilindrata in cc (es. 1968) — restringe i comparabili
  country:         Country         // mercato in cui cercare i comparabili
  mileageKm:       number
}

export interface VehicleEstimate {
  valueMinor:      number      // mediana in EUR minor units (centesimi)
  currency:        'EUR'
  sampleSize:      number      // n. annunci comparabili usati
  confidence:      Confidence  // quanto fidarsi del prezzo trovato
  relaxationLevel: number      // indice del livello di RELAXATION_LEVELS raggiunto (0 = match pieno)
}

// Un "livello" descrive quanto sono stretti i filtri di ricerca. Marca/modello
// non vengono mai rilassati (un'altra vettura non è più comparabile). anno/km
// sono i parametri sempre presenti; potenza e cilindrata restringono ulteriormente
// se note; carburante e cambio sono booleani sull'annuncio.
interface RelaxationLevel {
  label:             string          // solo per i log
  yearTolerance:     number          // ± anni di immatricolazione
  kmFrac:            number          // ± frazione sul chilometraggio (0.20 = ±20%)
  powerFrac:         number | null   // ± frazione sulla potenza, null = filtro escluso dalla query
  displacementFrac:  number | null   // ± frazione sulla cilindrata, null = filtro escluso dalla query
  fuel:              boolean         // includi il filtro carburante se noto
  gearbox:           boolean         // includi il filtro cambio se noto
}

// Cascata di rilassamento, dal più stretto (indice 0) al più permissivo. Il
// carburante è il filtro che pesa di più sul prezzo (benzina vs diesel vs
// elettrico non sono intercambiabili) e quindi è l'ultimo a cadere; la
// cilindrata è il primo a cadere perché è già ridondante con la potenza per
// la maggior parte dei modelli.
const RELAXATION_LEVELS: RelaxationLevel[] = [
  { label: 'completo',    yearTolerance: 1, kmFrac: 0.20, powerFrac: 0.15, displacementFrac: 0.10, fuel: true,  gearbox: true  },
  { label: '-cilindrata', yearTolerance: 1, kmFrac: 0.25, powerFrac: 0.15, displacementFrac: null, fuel: true,  gearbox: true  },
  { label: '-cambio',     yearTolerance: 1, kmFrac: 0.25, powerFrac: 0.25, displacementFrac: null, fuel: true,  gearbox: false },
  { label: '-potenza',    yearTolerance: 2, kmFrac: 0.35, powerFrac: null, displacementFrac: null, fuel: true,  gearbox: false },
  { label: '-carburante', yearTolerance: 2, kmFrac: 0.50, powerFrac: null, displacementFrac: null, fuel: false, gearbox: false },
]

// Livello massimo (incluso) considerato ancora "alta confidenza": i filtri
// principali (anno, km, potenza) sono pressoché quelli richiesti.
const HIGH_CONFIDENCE_MAX_LEVEL = 1
// Oltre questo livello la query ha rilasciato anche potenza/cambio: il prezzo
// resta indicativo ma va trattato con più cautela.
const MEDIUM_CONFIDENCE_MAX_LEVEL = 2

// Slug euristico per marca/modello nell'URL di ricerca (es. "Alfa Romeo" → "alfa-romeo").
// AutoScout24 non espone un endpoint pubblico di risoluzione taxonomy → best-effort:
// funziona per la maggior parte dei casi comuni ma non è garantito per ogni modello
// (es. sigle o nomi con formattazioni particolari). Se lo slug non esiste, la ricerca
// ritorna 0 risultati e la funzione si comporta come qualsiasi altro fallimento (null).
function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildSearchUrl(v: VehicleQuery, level: RelaxationLevel): string {
  const makeSlug  = slugify(v.make)
  const modelSlug = slugify(v.model)
  const kmFrom = Math.max(0, Math.round(v.mileageKm * (1 - level.kmFrac)))
  const kmTo   = Math.round(v.mileageKm * (1 + level.kmFrac))

  const params = new URLSearchParams({
    fregfrom: String(v.year - level.yearTolerance),
    fregto:   String(v.year + level.yearTolerance),
    kmfrom:   String(kmFrom),
    kmto:     String(kmTo),
    cy:       COUNTRY_CODE[v.country],
  })
  if (level.fuel && v.fuel)       params.set('fuel', FUEL_CODE[v.fuel])
  if (level.gearbox && v.gearbox) params.set('gear', GEAR_CODE[v.gearbox])
  if (level.powerFrac !== null && v.powerHp) {
    params.set('powerfrom', String(Math.max(0, Math.round(v.powerHp * (1 - level.powerFrac)))))
    params.set('powerto',   String(Math.round(v.powerHp * (1 + level.powerFrac))))
    params.set('powertype', 'hp')
  }
  if (level.displacementFrac !== null && v.displacementCc) {
    params.set('ccmfrom', String(Math.max(0, Math.round(v.displacementCc * (1 - level.displacementFrac)))))
    params.set('ccmto',   String(Math.round(v.displacementCc * (1 + level.displacementFrac))))
  }

  return `${BASE}/lst/${makeSlug}/${modelSlug}?${params.toString()}`
}

interface NextDataListing {
  price?: { priceRaw?: number }
  vehicle?: { offerType?: string; isCurrentlyDamaged?: boolean }
}

interface NextDataPageProps {
  numberOfResults?: number
  listings?: NextDataListing[]
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// Interpolazione lineare (metodo R-7, lo stesso di numpy/Excel) — sufficiente
// per un IQR indicativo su campioni piccoli come i nostri.
function quantile(sortedValues: number[], q: number): number {
  const pos = (sortedValues.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  const next = sortedValues[base + 1]
  return next === undefined ? sortedValues[base] : sortedValues[base] + rest * (next - sortedValues[base])
}

function downgrade(c: Confidence): Confidence {
  return c === 'high' ? 'medium' : 'low'
}

/**
 * Stabilisce quanto fidarsi del prezzo mediano trovato, combinando tre segnali:
 *  1. livello di rilassamento raggiunto (dominante — filtri stretti = base alta)
 *  2. numerosità del campione (appena sopra la soglia minima → declassa)
 *  3. dispersione dei prezzi (IQR/mediana alto → i comparabili non sono davvero
 *     comparabili tra loro → declassa)
 * Funzione pura, testabile in isolamento.
 */
export function scoreConfidence(input: { level: number; sampleSize: number; prices: number[] }): Confidence {
  const { level, sampleSize, prices } = input

  let score: Confidence =
    level <= HIGH_CONFIDENCE_MAX_LEVEL ? 'high' :
    level <= MEDIUM_CONFIDENCE_MAX_LEVEL ? 'medium' : 'low'

  if (sampleSize < MIN_SAMPLE_SIZE + 2) {
    score = downgrade(score)
  }

  const sorted = [...prices].sort((a, b) => a - b)
  const med = median(sorted)
  if (med > 0) {
    const iqr = quantile(sorted, 0.75) - quantile(sorted, 0.25)
    if (iqr / med > 0.5) score = downgrade(score)
  }

  return score
}

/**
 * Stima il valore di mercato di un veicolo cercando annunci comparabili su
 * AutoScout24, partendo da un match stretto (marca/modello/anno ±1/km ±20%/
 * potenza ±15%/cilindrata ±10% se note, nel mercato `country` indicato) e
 * allentando progressivamente i filtri (RELAXATION_LEVELS) finché non si
 * raggiunge un campione di almeno MIN_SAMPLE_SIZE comparabili — o si esauriscono
 * i livelli. Il prezzo è la mediana; la confidenza riflette quanto i filtri sono
 * stati allentati (vedi scoreConfidence). Non lancia mai eccezioni: ritorna null
 * su qualunque anomalia strutturale (rete, pagina cambiata) o se nessun livello
 * raggiunge il campione minimo.
 *
 * NOTA: la trazione (fwd/rwd/awd) non è filtrabile — verificato che AutoScout24
 * non espone un parametro di ricerca funzionante per questo campo (nessuno dei
 * nomi tentati incide sul conteggio risultati). Va salvata solo come dato
 * informativo su vehicle_details, non passata qui.
 */
export async function estimateVehicleValue(v: VehicleQuery): Promise<VehicleEstimate | null> {
  if (!ENABLED) return null

  try {
    for (let level = 0; level < RELAXATION_LEVELS.length; level++) {
      const cfg = RELAXATION_LEVELS[level]
      const url = buildSearchUrl(v, cfg)
      const res = await fetch(url, {
        headers: {
          'User-Agent':       USER_AGENT,
          'Accept-Language':  'it-IT,it;q=0.9',
        },
        next: { revalidate: 0 },
      })
      if (!res.ok) {
        // Fallimento di rete/HTTP: probabilmente un problema di sito, non di
        // query — non ha senso riprovare con filtri diversi, si abbandona.
        console.warn(`[autoscout24] HTTP ${res.status} per "${v.make} ${v.model}" (livello ${level} "${cfg.label}")`)
        return null
      }

      const html = await res.text()
      const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
      if (!match) {
        console.warn('[autoscout24] __NEXT_DATA__ non trovato — struttura pagina cambiata?')
        return null
      }

      let pageProps: NextDataPageProps
      try {
        const parsed = JSON.parse(match[1]) as { props?: { pageProps?: NextDataPageProps } }
        pageProps = parsed.props?.pageProps ?? {}
      } catch (e) {
        console.warn('[autoscout24] JSON __NEXT_DATA__ non parsabile:', e)
        return null
      }

      const prices = (pageProps.listings ?? [])
        .filter((l) => l.vehicle?.offerType === 'U' && !l.vehicle?.isCurrentlyDamaged)
        .map((l) => l.price?.priceRaw)
        .filter((p): p is number => typeof p === 'number' && p > 0)

      if (prices.length < MIN_SAMPLE_SIZE) {
        console.info(`[autoscout24] livello ${level} "${cfg.label}" per "${v.make} ${v.model}": solo ${prices.length} comparabili — allargo i filtri`)
        continue
      }

      const confidence = scoreConfidence({ level, sampleSize: prices.length, prices })
      console.info(`[autoscout24] stima per "${v.make} ${v.model}" al livello ${level} "${cfg.label}": ${prices.length} comparabili, confidence=${confidence}`)

      return {
        valueMinor:      Math.round(median(prices) * 100),
        currency:        'EUR',
        sampleSize:      prices.length,
        confidence,
        relaxationLevel: level,
      }
    }

    console.info(`[autoscout24] nessun livello ha trovato ${MIN_SAMPLE_SIZE}+ comparabili per "${v.make} ${v.model}"`)
    return null
  } catch (e) {
    console.warn(`[autoscout24] Errore di rete/parsing per "${v.make} ${v.model}":`, e)
    return null
  }
}

/**
 * Converte una Quote-like { price, currency } dal risultato mediano, per uniformità
 * stilistica con gli altri provider (non implementa PriceProvider — il veicolo non
 * ha un "symbol", ha un VehicleQuery strutturato).
 */
export function toQuote(estimate: VehicleEstimate): Quote {
  return {
    price:    (estimate.valueMinor / 100).toString(),
    currency: estimate.currency,
    asOf:     Math.floor(Date.now() / 1000),
  }
}
