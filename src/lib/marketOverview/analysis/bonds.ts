// src/lib/marketOverview/analysis/bonds.ts — Sintesi obbligazionaria (Area euro,
// focus BTP): interpola livello del rendimento, rendimento reale, pendenza della
// curva e spread BTP-Bund in una posizione argomentata.
import { getBondMacro, getUsBondMacro, type BondMacro, type UsBondMacro } from '../bonds'
import { synthesize, fmtIt, driverYieldPercentile, driverRealYield, driverCurveSlope, driverSpread } from './scoring'
import type { SectorAnalysis } from './types'

const SRC = 'BCE (ECB Data Portal)'
const SRC_FRED = 'FRED (Federal Reserve di St. Louis)'
const LEARN = [
  { label: 'Curva dei rendimenti euro (BCE)', href: 'https://data.ecb.europa.eu/data/data-categories/financial-markets-and-interest-rates/euro-area-yield-curves' },
  { label: 'Spread BTP-Bund: cos’è e perché conta', href: 'https://www.borsaitaliana.it/notizie/sotto-la-lente/spread-btp-bund.htm' },
]

// Sotto-analisi USA. Le obbligazioni societarie ad alto rendimento NON hanno una
// valutazione: lo spread di credito pubblico copre solo 3 anni, troppo pochi per
// dire se è "alto" o "basso" (resta, descrittivo, nel quadro macro).
function analyzeUsBonds(us: UsBondMacro): SectorAnalysis[] {
  return [
    synthesize({
      key: 'bonds.us',
      title: 'Titoli di Stato USA',
      asOf: us.asOf,
      drivers: [
        driverYieldPercentile({ label: 'Livello rendimento Treasury 10 anni', source: SRC_FRED, weight: 2 }, us.us10yPct, '10 anni'),
        driverRealYield({ label: 'Rendimento reale', source: SRC_FRED, weight: 2 }, us.tips10y, 'titoli indicizzati all’inflazione'),
        driverCurveSlope({ label: 'Pendenza curva 10Y-2Y', source: SRC_FRED, weight: 1 }, us.slope),
      ],
    }),
  ]
}

export async function analyzeBonds(macro?: BondMacro, usMacro?: UsBondMacro): Promise<SectorAnalysis> {
  const m = macro ?? await getBondMacro()
  const us = usMacro ?? await getUsBondMacro()

  const drivers = [
    driverYieldPercentile({ label: 'Livello rendimento BTP', source: SRC, weight: 2, signalCode: 'bonds.it10y' }, m.it10yPct, '10 anni'),
    driverRealYield({ label: 'Rendimento reale', source: SRC, weight: 2 }, m.realYield),
    driverCurveSlope({ label: 'Pendenza curva 10Y-2Y', source: SRC, weight: 1 }, m.slope),
    driverSpread({ label: 'Spread BTP-Bund', source: SRC, weight: 1 }, m.spreadBps),
  ]

  const note = m.it10y !== null
    ? `Il BTP a 10 anni rende ${fmtIt(m.it10y, 2)}%` +
      (m.realYield !== null && m.inflation !== null ? `, pari a ${fmtIt(m.realYield, 1)}% reale al netto dell'inflazione (${fmtIt(m.inflation, 1)}%).` : '.') +
      (m.slope !== null ? ` La curva è ${m.slope >= 0 ? 'positiva' : 'invertita'} (${fmtIt(m.slope, 2)}pp).` : '')
    : undefined

  return synthesize({
    key: 'bonds',
    title: 'Obbligazionario (Area euro · BTP)',
    drivers,
    asOf: m.asOf,
    learnMore: LEARN,
    historicalNote: note,
    subMarkets: analyzeUsBonds(us),
  })
}
