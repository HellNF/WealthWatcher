// src/lib/marketOverview/analysis/crypto.ts — Sintesi crypto (Bitcoin):
// interpola sentiment (Fear & Greed), posizione nel ciclo (BTC vs media 200
// settimane) e momentum in una posizione argomentata. La dominance è contesto.
import { getBtcCycle } from '../crypto'
import { synthesize, driverFearGreed, driverBtc200w, driverMomentum } from './scoring'
import type { SectorAnalysis } from './types'

const LEARN = [
  { label: 'Fear & Greed Index — metodologia', href: 'https://alternative.me/crypto/fear-and-greed-index/' },
  { label: 'La media a 200 settimane di Bitcoin', href: 'https://www.coingecko.com/en/coins/bitcoin' },
]

export async function analyzeCrypto(): Promise<SectorAnalysis> {
  const c = await getBtcCycle()

  const drivers = [
    driverFearGreed({ label: 'Sentiment (Fear & Greed)', source: 'alternative.me', weight: 1.5, signalCode: 'crypto.fng' }, c.fearGreed),
    driverBtc200w({ label: 'Posizione nel ciclo (media 200 settimane)', source: 'Yahoo Finance', weight: 2 }, c.pctAbove200w),
    driverMomentum({ label: 'Momentum 90 giorni', source: 'Yahoo Finance', weight: 1 }, c.momentum90d, '90g'),
  ]

  const note = [
    c.pctAbove200w !== null ? `Bitcoin è ${c.pctAbove200w >= 0 ? 'sopra' : 'sotto'} la media a 200 settimane del ${Math.abs(c.pctAbove200w).toFixed(0)}%` : null,
    c.dominance !== null ? `dominance BTC al ${c.dominance.toFixed(0)}%` : null,
  ].filter(Boolean).join('; ')

  return synthesize({
    key: 'crypto',
    title: 'Criptovalute (Bitcoin)',
    drivers,
    asOf: c.asOf,
    learnMore: LEARN,
    historicalNote: note ? `${note.charAt(0).toUpperCase()}${note.slice(1)}.` : undefined,
  })
}
