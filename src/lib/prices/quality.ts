import type { Position } from '@/lib/positions'
// Observation age is not a claim about exchange opening hours. Provider dates remain visible.
export function summarizePriceQuality(positions: Position[], now = Date.now() / 1000) {
  const active = positions.filter(p => Number(p.remainingQty) > 0)
  const dated = active.filter(p => p.lastPrice && p.lastPriceAt)
  return {
    total: active.length,
    missing: active.filter(p => !p.lastPrice || !p.lastPriceAt).length,
    aged: dated.filter(p => now - p.lastPriceAt! > 86400).length,
    legacy: dated.filter(p => !p.priceSource).length,
    sources: [...new Set(dated.map(p => p.priceSource ?? 'Origine storica non verificata'))],
    oldest: dated.length ? Math.min(...dated.map(p => p.lastPriceAt!)) : null,
    newest: dated.length ? Math.max(...dated.map(p => p.lastPriceAt!)) : null,
  }
}
