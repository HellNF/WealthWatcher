// src/lib/marketOverview/performance.ts — "Come si stanno muovendo i mercati":
// rendimenti su più orizzonti dei principali mercati e dei settori azionari.
// È la parte puramente descrittiva della pagina: nessun giudizio, solo quanto
// ha reso cosa, su quale periodo.
//
// Nota metodologica (mostrata in pagina): rendimenti in valuta locale. Per gli
// ETF (mondo, emergenti, obbligazioni, settori) i dividendi sono inclusi; per
// gli indici (S&P 500, STOXX 600, FTSE MIB, Nikkei) no, quindi il loro
// rendimento reale è un po' più alto di quello mostrato.
import { getAdjustedCloses, type PricePoint } from '@/lib/prices/yahoo'

export type PerfGroup = 'equity' | 'bonds' | 'commodities' | 'crypto' | 'sector'

export interface PerfReturns {
  m1:    number | null   // % ultimo mese
  m3:    number | null
  ytd:   number | null   // % da inizio anno
  y1:    number | null
  y5ann: number | null   // % MEDIO ANNUO sugli ultimi 5 anni
}

export interface PerfRow {
  key:         string
  group:       PerfGroup
  title:       string
  detail:      string          // cosa si sta misurando, es. "indice S&P 500"
  currency:    string | null
  asOf:        string          // data dell'ultima chiusura
  returns:     PerfReturns
  drawdownPct: number | null   // % sotto il massimo delle ultime 52 settimane
}

export interface PerformanceBoard {
  rows: PerfRow[]
  asOf: number
}

interface Spec { key: string; group: PerfGroup; title: string; detail: string; symbol: string }

const SPECS: Spec[] = [
  { key: 'world',   group: 'equity', title: 'Azioni mondo',        detail: 'MSCI World (ETF, dividendi inclusi)',  symbol: 'URTH' },
  { key: 'us',      group: 'equity', title: 'Stati Uniti',         detail: 'indice S&P 500',                       symbol: '^GSPC' },
  { key: 'us_tech', group: 'equity', title: 'USA tecnologia',      detail: 'indice Nasdaq 100',                    symbol: '^NDX' },
  { key: 'europe',  group: 'equity', title: 'Europa',              detail: 'indice STOXX Europe 600',              symbol: '^STOXX' },
  { key: 'italy',   group: 'equity', title: 'Italia',              detail: 'indice FTSE MIB',                      symbol: 'FTSEMIB.MI' },
  { key: 'japan',   group: 'equity', title: 'Giappone',            detail: 'indice Nikkei 225',                    symbol: '^N225' },
  { key: 'em',      group: 'equity', title: 'Paesi emergenti',     detail: 'MSCI Emerging Markets (ETF, dividendi inclusi)', symbol: 'EEM' },
  { key: 'eur_bonds', group: 'bonds', title: 'Obbligazioni euro',  detail: 'titoli di Stato e societari in euro (ETF, cedole incluse)', symbol: 'IEAG.AS' },
  { key: 'gold',    group: 'commodities', title: 'Oro',            detail: 'future sull’oro',                      symbol: 'GC=F' },
  { key: 'oil',     group: 'commodities', title: 'Petrolio',       detail: 'future sul Brent',                     symbol: 'BZ=F' },
  { key: 'btc',     group: 'crypto', title: 'Bitcoin',             detail: 'prezzo in dollari',                    symbol: 'BTC-USD' },
  // Settori dell'azionario USA (ETF "Select Sector SPDR", dividendi inclusi).
  { key: 'sec_tech',      group: 'sector', title: 'Tecnologia',               detail: 'XLK', symbol: 'XLK' },
  { key: 'sec_comm',      group: 'sector', title: 'Comunicazione e media',    detail: 'XLC', symbol: 'XLC' },
  { key: 'sec_discr',     group: 'sector', title: 'Consumi non essenziali',   detail: 'XLY', symbol: 'XLY' },
  { key: 'sec_staples',   group: 'sector', title: 'Beni di prima necessità',  detail: 'XLP', symbol: 'XLP' },
  { key: 'sec_health',    group: 'sector', title: 'Salute',                   detail: 'XLV', symbol: 'XLV' },
  { key: 'sec_fin',       group: 'sector', title: 'Finanza',                  detail: 'XLF', symbol: 'XLF' },
  { key: 'sec_ind',       group: 'sector', title: 'Industria',                detail: 'XLI', symbol: 'XLI' },
  { key: 'sec_energy',    group: 'sector', title: 'Energia',                  detail: 'XLE', symbol: 'XLE' },
  { key: 'sec_materials', group: 'sector', title: 'Materiali di base',        detail: 'XLB', symbol: 'XLB' },
  { key: 'sec_util',      group: 'sector', title: 'Servizi di pubblica utilità', detail: 'XLU', symbol: 'XLU' },
  { key: 'sec_re',        group: 'sector', title: 'Immobiliare',              detail: 'XLRE', symbol: 'XLRE' },
]

// ── Calcolo (puro, testato) ───────────────────────────────────────────────────

/** Ultima chiusura con data ≤ `iso`. Null se la serie inizia dopo. */
export function closeOnOrBefore(points: PricePoint[], iso: string): number | null {
  let lo = 0, hi = points.length - 1, found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (points[mid].date <= iso) { found = mid; lo = mid + 1 } else hi = mid - 1
  }
  return found === -1 ? null : points[found].close
}

function shiftIso(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() - months)
  return d.toISOString().slice(0, 10)
}

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * Rendimenti alla data dell'ultima chiusura. Un orizzonte è null se la serie non
 * copre l'intero periodo (tolleranza: il primo dato deve essere entro 10 giorni
 * dall'inizio del periodo), così non si spaccia per "5 anni" una storia più corta.
 */
export function computeReturns(points: PricePoint[]): { returns: PerfReturns; drawdownPct: number | null } {
  const empty: PerfReturns = { m1: null, m3: null, ytd: null, y1: null, y5ann: null }
  if (points.length < 2) return { returns: empty, drawdownPct: null }
  const lastPoint = points[points.length - 1]
  const first = points[0].date

  const since = (startIso: string): number | null => {
    if (shiftDays(first, 10) > startIso) return null
    const base = closeOnOrBefore(points, startIso) ?? points[0].close
    return base > 0 ? lastPoint.close / base - 1 : null
  }
  const pct = (r: number | null) => (r === null ? null : round1(r * 100))

  const y5 = since(shiftIso(lastPoint.date, 60))
  const yearStart = `${parseInt(lastPoint.date.slice(0, 4), 10) - 1}-12-31`

  const yearAgo = shiftIso(lastPoint.date, 12)
  const window = points.filter((p) => p.date >= yearAgo)
  const high = Math.max(...window.map((p) => p.close))

  return {
    returns: {
      m1:    pct(since(shiftIso(lastPoint.date, 1))),
      m3:    pct(since(shiftIso(lastPoint.date, 3))),
      ytd:   pct(since(yearStart)),
      y1:    pct(since(yearAgo)),
      y5ann: y5 === null ? null : round1((Math.pow(1 + y5, 1 / 5) - 1) * 100),
    },
    drawdownPct: high > 0 ? round1((1 - lastPoint.close / high) * 100) : null,
  }
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function buildPerformanceBoard(): Promise<PerformanceBoard> {
  const from = new Date(); from.setFullYear(from.getFullYear() - 5); from.setDate(from.getDate() - 20)
  const fromIso = from.toISOString().slice(0, 10)

  const rows: PerfRow[] = []
  // Sequenziale con pausa: tante chiamate Yahoo ravvicinate rischiano il throttle.
  for (const spec of SPECS) {
    const { points, currency } = await getAdjustedCloses(spec.symbol, fromIso)
    if (points.length < 30) {
      console.warn(`[market] andamenti: storico insufficiente per ${spec.symbol} (${points.length} punti), riga omessa`)
    } else {
      const { returns, drawdownPct } = computeReturns(points)
      rows.push({
        key: spec.key, group: spec.group, title: spec.title, detail: spec.detail,
        currency, asOf: points[points.length - 1].date, returns, drawdownPct,
      })
    }
    await sleep(250)
  }
  return { rows, asOf: Math.floor(Date.now() / 1000) }
}
