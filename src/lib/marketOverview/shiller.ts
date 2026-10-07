// src/lib/marketOverview/shiller.ts — Dataset storico di Robert Shiller (Yale,
// Nobel 2013): prezzi, utili, inflazione e CAPE della borsa USA, mensili dal
// 1871. È LA fonte di riferimento per le valutazioni azionarie di lungo periodo
// ed è ciò che permette di rispondere con i dati — non con un'opinione — a
// "com'è andata, storicamente, a chi ha investito in condizioni simili a oggi?".
//
// Il file aggiornato è pubblicato su shillerdata.com (il link cambia a ogni
// revisione → lo si legge dalla pagina); la vecchia copia su econ.yale.edu è
// ferma al 2023 e fa solo da ripiego, scartata se troppo vecchia.
import * as XLSX from 'xlsx'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'

export interface ShillerRow {
  date:   string         // YYYY-MM
  price:  number         // S&P Composite, media mensile (nominale)
  realTR: number         // indice total return reale (dividendi reinvestiti, al netto dell'inflazione)
  cape:   number | null  // P/E10 di Shiller
  ecy:    number | null  // Excess CAPE Yield, in % (rendimento degli utili − tasso reale a 10 anni)
}

const HOME = 'https://shillerdata.com/'
const YALE_FALLBACK = 'http://www.econ.yale.edu/~shiller/data/ie_data.xls'
const MAX_AGE_MONTHS = 4

/** Estrae dalla home di shillerdata.com il link al file `ie_data.xls` corrente. */
export function findShillerUrl(html: string): string | null {
  const m = html.match(/href="([^"]*\/ie_data\.xls[^"]*)"/i)
  if (!m) return null
  const href = m[1].replace(/&amp;/g, '&')
  return href.startsWith('//') ? `https:${href}` : href
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/**
 * Converte le righe grezze del foglio "Data" in ShillerRow. Colonne (fisse da
 * anni): 0 data, 1 prezzo, 5 data frazionaria, 9 prezzo total return reale,
 * 12 CAPE, 16 Excess CAPE Yield. Il mese si ricava dalla data FRAZIONARIA: la
 * colonna 0 è ambigua (2026.1 è ottobre, 2026.01 gennaio — come numero coincidono).
 */
export function parseShillerRows(rows: unknown[][]): ShillerRow[] {
  const out: ShillerRow[] = []
  for (const r of rows) {
    const frac = num(r[5]); const price = num(r[1]); const realTR = num(r[9])
    if (frac === null || price === null || realTR === null || frac < 1800 || frac > 2200) continue
    const year = Math.floor(frac)
    const month = Math.min(12, Math.max(1, Math.round((frac - year) * 12 + 0.5)))
    const ecy = num(r[16])
    out.push({
      date: `${year}-${String(month).padStart(2, '0')}`,
      price, realTR,
      cape: num(r[12]),
      ecy: ecy === null ? null : ecy * 100,
    })
  }
  return out
}

function monthsOld(lastDate: string, now: Date): number {
  const [y, m] = lastDate.split('-').map(Number)
  return (now.getUTCFullYear() - y) * 12 + (now.getUTCMonth() + 1 - m)
}

async function download(url: string): Promise<ShillerRow[]> {
  const res = await fetchWithTimeout(url, { cache: 'no-store' }, 45_000)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const wb = XLSX.read(Buffer.from(await res.arrayBuffer()), { type: 'buffer' })
  const sheet = wb.Sheets['Data']
  if (!sheet) throw new Error('foglio "Data" assente')
  return parseShillerRows(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as unknown[][])
}

/**
 * Scarica il dataset. Ritorna null (loggando il motivo) se non è raggiungibile,
 * se la struttura è cambiata o se i dati sono più vecchi di `MAX_AGE_MONTHS`:
 * meglio nessuna evidenza storica che una calcolata su una valutazione scaduta.
 */
export async function fetchShiller(): Promise<ShillerRow[] | null> {
  const candidates: string[] = []
  try {
    const res = await fetchWithTimeout(HOME, { cache: 'no-store' }, 20_000)
    const url = res.ok ? findShillerUrl(await res.text()) : null
    if (url) candidates.push(url)
    else console.warn(`[market] Shiller: link al dataset non trovato su ${HOME} (HTTP ${res.status})`)
  } catch (e) {
    console.warn('[market] Shiller: home non raggiungibile:', e instanceof Error ? e.message : e)
  }
  candidates.push(YALE_FALLBACK)

  const now = new Date()
  for (const url of candidates) {
    try {
      const rows = await download(url)
      const lastRow = rows[rows.length - 1]
      if (rows.length < 1200 || !lastRow) { console.warn(`[market] Shiller: struttura inattesa da ${url} (${rows.length} righe)`); continue }
      const age = monthsOld(lastRow.date, now)
      if (age > MAX_AGE_MONTHS) { console.warn(`[market] Shiller: dati fermi a ${lastRow.date} su ${url}, scartati`); continue }
      return rows
    } catch (e) {
      console.warn(`[market] Shiller: download fallito da ${url}:`, e instanceof Error ? e.message : e)
    }
  }
  return null
}
