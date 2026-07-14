// src/lib/marketOverview/analysis/commodities.ts — Sintesi materie prime, con
// approfondimento sull'ORO: interpola percentile di prezzo, trend vs media
// 200gg, rapporto oro/argento, legame con i rendimenti reali e momentum.
// Petrolio/rame/gas come sotto-analisi più leggere (percentile).
import type { MarketSignal } from '../signals'
import { fetchTrendMetrics } from './seriesMetrics'
import {
  synthesize, driverPricePercentile, driverTrendVsMA, driverGoldSilver,
  driverGoldVsRealYield, driverMomentum,
} from './scoring'
import type { SectorAnalysis } from './types'

const SRC = 'Yahoo Finance'
const LEARN = [
  { label: 'Cosa muove il prezzo dell’oro (rendimenti reali)', href: 'https://www.gold.org/goldhub/research/relevance-of-gold-as-a-strategic-asset' },
  { label: 'Rapporto oro/argento', href: 'https://www.lbma.org.uk/prices-and-data/precious-metal-prices' },
]

const LIGHT: { code: string; title: string }[] = [
  { code: 'commodities.oil',    title: 'Petrolio (Brent)' },
  { code: 'commodities.copper', title: 'Rame' },
  { code: 'commodities.natgas', title: 'Gas naturale' },
]

export async function analyzeCommodities(signals: MarketSignal[], realYield: number | null): Promise<SectorAnalysis> {
  const gold   = signals.find((s) => s.code === 'commodities.gold')
  const silver = signals.find((s) => s.code === 'commodities.silver')
  const gm     = await fetchTrendMetrics('GC=F')

  const ratio = gold && silver && silver.value > 0 ? gold.value / silver.value : null

  const drivers = [
    driverPricePercentile({ label: 'Prezzo oro (percentile 10 anni)', source: SRC, weight: 2, signalCode: 'commodities.gold' }, gold?.percentile ?? null, '10 anni'),
    driverTrendVsMA({ label: 'Trend vs media 200gg', source: SRC, weight: 1 }, gm.pctFromMA200),
    driverGoldVsRealYield({ label: 'Rendimenti reali (costo-opportunità)', source: 'BCE (ECB Data Portal)', weight: 1.5 }, realYield),
    driverGoldSilver({ label: 'Rapporto oro/argento', source: SRC, weight: 1 }, ratio),
    driverMomentum({ label: 'Momentum 12m', source: SRC, weight: 0.5 }, gm.momentumPct, '12m'),
  ]

  const note = gold
    ? `L'oro è al ${Math.round(gold.percentile ?? 0)}° percentile del decennio` +
      (ratio !== null ? `, rapporto oro/argento a ${ratio.toFixed(0)}.` : '.')
    : undefined

  const subMarkets = LIGHT.map((l) => {
    const s = signals.find((x) => x.code === l.code)
    return synthesize({
      key: l.code,
      title: l.title,
      drivers: [driverPricePercentile({ label: 'Prezzo (percentile 10 anni)', source: SRC, weight: 1, signalCode: l.code }, s?.percentile ?? null, '10 anni')],
      asOf: s?.asOf ?? Math.floor(Date.now() / 1000),
    })
  })

  return synthesize({
    key: 'commodities',
    title: 'Materie prime (oro)',
    drivers,
    asOf: gold?.asOf ?? Math.floor(Date.now() / 1000),
    learnMore: LEARN,
    historicalNote: note,
    subMarkets,
  })
}
