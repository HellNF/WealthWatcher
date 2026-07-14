// src/lib/marketOverview/analysis/bonds.ts — Sintesi obbligazionaria (Area euro,
// focus BTP): interpola livello del rendimento, rendimento reale, pendenza della
// curva e spread BTP-Bund in una posizione argomentata.
import { getBondMacro, type BondMacro } from '../bonds'
import { synthesize, driverYieldPercentile, driverRealYield, driverCurveSlope, driverSpread } from './scoring'
import type { SectorAnalysis } from './types'

const SRC = 'BCE (ECB Data Portal)'
const LEARN = [
  { label: 'Curva dei rendimenti euro (BCE)', href: 'https://data.ecb.europa.eu/data/data-categories/financial-markets-and-interest-rates/euro-area-yield-curves' },
  { label: 'Spread BTP-Bund: cos’è e perché conta', href: 'https://www.borsaitaliana.it/notizie/sotto-la-lente/spread-btp-bund.htm' },
]

export async function analyzeBonds(macro?: BondMacro): Promise<SectorAnalysis> {
  const m = macro ?? await getBondMacro()

  const drivers = [
    driverYieldPercentile({ label: 'Livello rendimento BTP', source: SRC, weight: 2, signalCode: 'bonds.it10y' }, m.it10yPct, '10 anni'),
    driverRealYield({ label: 'Rendimento reale', source: SRC, weight: 2 }, m.realYield),
    driverCurveSlope({ label: 'Pendenza curva 10Y-2Y', source: SRC, weight: 1 }, m.slope),
    driverSpread({ label: 'Spread BTP-Bund', source: SRC, weight: 1 }, m.spreadBps),
  ]

  const note = m.it10y !== null
    ? `Il BTP a 10 anni rende ${m.it10y.toFixed(2)}%` +
      (m.realYield !== null && m.inflation !== null ? `, pari a ${m.realYield.toFixed(1)}% reale al netto dell'inflazione (${m.inflation.toFixed(1)}%).` : '.') +
      (m.slope !== null ? ` La curva è ${m.slope >= 0 ? 'positiva' : 'invertita'} (${m.slope.toFixed(2)}pp).` : '')
    : undefined

  return synthesize({
    key: 'bonds',
    title: 'Obbligazionario (Area euro · BTP)',
    drivers,
    asOf: m.asOf,
    learnMore: LEARN,
    historicalNote: note,
  })
}
