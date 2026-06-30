// Frankfurter API client (ECB exchange rates, free, no API key).
// 1 EUR = rate × quote (e.g. { USD: 1.08 } means 1 EUR = 1.08 USD).
// Supports historical dates: fetchRates('2024-01-15') or fetchRates('latest').
// Never throws — returns null on network failure or unknown date.

const BASE_URL = process.env.FRANKFURTER_URL ?? 'https://api.frankfurter.app'

interface FrankfurterResponse {
  date:   string
  base:   string
  rates:  Record<string, number>
}

export async function fetchRates(
  date: 'latest' | string,  // 'latest' or ISO YYYY-MM-DD
): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(`${BASE_URL}/${date}?from=EUR`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json() as FrankfurterResponse
    return data.rates ?? null
  } catch {
    return null
  }
}
