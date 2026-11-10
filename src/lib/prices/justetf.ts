// Experimental adapter derived from the public requests inspected with API Anything.
// This is not a contracted market-data API. Its values never update instruments.
import { sqlite } from '@/db'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'
export interface EtfProfile {
  isin: string; name: string; terPercent: number | null
  distribution: string | null; replication: string | null
  currency: 'EUR'; includesDividends: true; retrievedAt: number
  performance: { date: string; percent: number }[]
}
const DAY = 86400
const inflight = new Map<string, Promise<EtfProfile>>()
const lastAttempt = new Map<string, number>()
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Formato justETF non riconosciuto')
  return value as Record<string, unknown>
}
function numericRaw(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null
  const raw = (value as { raw?: unknown }).raw
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null
}
export function validIsin(isin: string): boolean {
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) return false
  const digits = [...isin].map(c => /[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c).join('')
  return [...digits].reverse().reduce((sum, c, i) => {
    const n = Number(c) * (i % 2 ? 2 : 1); return sum + Math.floor(n / 10) + n % 10
  }, 0) % 10 === 0
}
function isoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}
export function parseEtfData(isin: string, cards: unknown, chart: unknown, from: string, to: string, retrievedAt: number): EtfProfile {
  const list = object(cards).etfs
  if (!Array.isArray(list)) throw new Error('Scheda justETF non disponibile')
  const matches = list.filter(item => object(item).isin === isin)
  if (matches.length !== 1) throw new Error('ISIN justETF non corrispondente')
  const card = object(matches[0])
  if (card.entityType !== 'ETF' || typeof card.name !== 'string' || !card.name.trim()) throw new Error('Strumento justETF non valido')
  const ter = numericRaw(card.ter)
  if (ter !== null && (ter < 0 || ter > 10)) throw new Error('TER justETF non valido')
  const icons = Array.isArray(card.icons) ? card.icons.map(i => object(i).name) : []
  const series = object(chart).series
  if (!Array.isArray(series) || series.length < 2 || series.length > 400) throw new Error('Serie justETF non disponibile')
  let previous = ''
  const performance = series.map(item => {
    const point = object(item); const percent = numericRaw(point.value)
    if (!isoDate(point.date) || point.date < from || point.date > to || point.date <= previous || percent === null || percent < -100) throw new Error('Serie justETF non valida')
    previous = point.date
    return { date: point.date, percent }
  })
  if (Math.abs(performance[0].percent) > 0.01) throw new Error('Base del rendimento justETF non verificata')
  return { isin, name: card.name, terPercent: ter,
    distribution: icons.includes('acc') ? 'Accumulazione' : null,
    replication: icons.includes('phy') ? 'Fisica' : null,
    currency: 'EUR', includesDividends: true, retrievedAt, performance }
}
export function getCachedEtf(isin: string): EtfProfile | null {
  const row = sqlite.prepare('SELECT profile_json, performance_json FROM etf_profiles WHERE isin = ?').get(isin) as { profile_json: string; performance_json: string } | undefined
  if (!row) return null
  try { return { ...JSON.parse(row.profile_json), performance: JSON.parse(row.performance_json) } as EtfProfile } catch { return null }
}
export async function refreshEtf(isin: string): Promise<EtfProfile> {
  if (!validIsin(isin)) throw new Error('ISIN non valido: verifica la scheda dello strumento')
  const now = Math.floor(Date.now() / 1000)
  const cached = getCachedEtf(isin)
  if (cached && now - cached.retrievedAt < DAY) return cached
  const pending = inflight.get(isin)
  if (pending) return pending
  if (now - (lastAttempt.get(isin) ?? 0) < 60) throw new Error('Attendi un minuto prima di riprovare')
  lastAttempt.set(isin, now)
  const operation = (async () => {
    const end = new Date((now - DAY) * 1000)
    const to = end.toISOString().slice(0, 10)
    end.setUTCFullYear(end.getUTCFullYear() - 1)
    const from = end.toISOString().slice(0, 10)
    const base = 'https://www.justetf.com/api/etfs'
    const urls = [
      `${base}/cards?locale=it&currency=EUR&isin=${isin}`,
      `${base}/${isin}/performance-chart?locale=it&currency=EUR&valuesType=RELATIVE_CHANGE&reduceData=false&includeDividends=true&features=DIVIDENDS&dateFrom=${from}&dateTo=${to}`,
    ]
    const data = await Promise.all(urls.map(async url => {
      const response = await fetchWithTimeout(url, { cache: 'no-store', headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error('justETF non disponibile; la copia precedente resta consultabile')
      return response.json() as Promise<unknown>
    }))
    const profile = parseEtfData(isin, data[0], data[1], from, to, now)
    const { performance, ...metadata } = profile
    sqlite.prepare(`INSERT INTO etf_profiles (isin, source, retrieved_at, profile_json, performance_json)
      VALUES (?, 'justetf-experimental', ?, ?, ?) ON CONFLICT(isin) DO UPDATE SET
      retrieved_at = excluded.retrieved_at, profile_json = excluded.profile_json, performance_json = excluded.performance_json`)
      .run(isin, now, JSON.stringify(metadata), JSON.stringify(performance))
    return profile
  })()
  inflight.set(isin, operation)
  try { return await operation } finally { inflight.delete(isin) }
}
