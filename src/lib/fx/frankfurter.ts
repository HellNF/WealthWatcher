// Frankfurter API client (ECB exchange rates, free, no API key).
// 1 EUR = rate × quote (e.g. { USD: 1.08 } means 1 EUR = 1.08 USD).
// Supports historical dates: fetchRates('2024-01-15') or fetchRates('latest').
// Never throws — returns null on network failure or unknown date.
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'

const BASE_URL = process.env.FRANKFURTER_URL ?? 'https://api.frankfurter.app'

export interface FrankfurterResponse {
  date:   string
  base:   string
  rates:  Record<string, number>
}

export async function fetchRateSnapshot(
  date: 'latest' | string,  // 'latest' or ISO YYYY-MM-DD
): Promise<FrankfurterResponse | null> {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/${date}?from=EUR`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json() as FrankfurterResponse
    if (data.base !== 'EUR' || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)
        || !Number.isFinite(Date.parse(data.date)) || !data.rates
        || typeof data.rates !== 'object' || Array.isArray(data.rates)) return null
    const limit = date === 'latest' ? new Date().toISOString().slice(0, 10) : date
    if (data.date > limit) return null
    if (Object.values(data.rates).some((rate) => !Number.isFinite(rate) || rate <= 0)) return null
    return data
  } catch {
    return null
  }
}

export async function fetchRates(date: string): Promise<Record<string, number> | null> {
  return (await fetchRateSnapshot(date))?.rates ?? null
}
