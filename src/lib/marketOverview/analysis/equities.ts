// src/lib/marketOverview/analysis/equities.ts — Sintesi azionaria per area e
// settore. Ogni sotto-mercato interpola valutazione (P/E), distanza dai massimi,
// trend vs media 200gg, momentum e — per gli USA — volatilità (VIX). La sintesi
// di settore aggrega i sotto-mercati contrapponendo le aree più tese a quelle
// più distese.
import { getMarketMetrics, getQuoteValue } from '@/lib/prices/yahoo'
import { fetchTrendMetrics } from './seriesMetrics'
import {
  synthesize, driverPE, driverDrawdown, driverTrendVsMA, driverMomentum,
  driverVix, driverFromSubMarket, driverCape, driverExcessYield,
} from './scoring'
import type { SectorAnalysis } from './types'
import type { EquityEvidence } from '../evidence'

const SRC = 'Yahoo Finance'
const SRC_SHILLER = 'Robert Shiller (Yale)'

interface SubSpec {
  key:        string
  title:      string
  symbol:     string   // indice per prezzo/trend
  pePeer:     string   // ETF da cui leggere il P/E (gli indici non lo espongono)
  us:         boolean  // applica il VIX
  shiller?:   boolean  // applica CAPE ed Excess CAPE Yield (calcolati sull'S&P)
  weight:     number   // peso nella sintesi di settore
  signalCode?: string  // grafico di supporto già in cache (se presente)
}

const SUBS: SubSpec[] = [
  { key: 'equities.us',      title: 'USA (S&P 500)',          symbol: '^GSPC',     pePeer: 'SPY', us: true,  weight: 2,   signalCode: 'equities.sp500', shiller: true },
  { key: 'equities.us_tech', title: 'USA Tech (Nasdaq 100)',  symbol: '^NDX',      pePeer: 'QQQ', us: true,  weight: 1.5 },
  { key: 'equities.europe',  title: 'Europa (Euro Stoxx 50)', symbol: '^STOXX50E', pePeer: 'FEZ', us: false, weight: 1.5, signalCode: 'equities.stoxx' },
  { key: 'equities.em',      title: 'Mercati emergenti',      symbol: 'EEM',       pePeer: 'EEM', us: false, weight: 1 },
  { key: 'equities.japan',   title: 'Giappone (Nikkei 225)',  symbol: '^N225',     pePeer: 'EWJ', us: false, weight: 1 },
]

const LEARN = [
  { label: 'CAPE / Shiller P/E (valutazioni azionarie)', href: 'https://www.multpl.com/shiller-pe' },
  { label: 'Indice VIX: la “paura” del mercato', href: 'https://www.cboe.com/tradable_products/vix/' },
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function analyzeSub(spec: SubSpec, vix: number | null, evidence: EquityEvidence | null): Promise<SectorAnalysis> {
  const tm = await fetchTrendMetrics(spec.symbol)
  const metrics = await getMarketMetrics(spec.pePeer)

  const drivers = [
    driverPE({ label: 'Valutazione (P/E)', source: SRC, weight: 2 }, metrics.trailingPE),
    driverDrawdown({ label: 'Distanza dai max 52w', source: SRC, weight: 1, ...(spec.signalCode ? { signalCode: spec.signalCode } : {}) }, tm.drawdownPct),
    driverTrendVsMA({ label: 'Trend vs media 200gg', source: SRC, weight: 1 }, tm.pctFromMA200),
    driverMomentum({ label: 'Momentum 12m', source: SRC, weight: 0.5 }, tm.momentumPct, '12m'),
    // Il VIX misura la borsa USA: altrove non è un dato mancante, è fuori tema.
    ...(spec.us ? [driverVix({ label: 'Volatilità (VIX)', source: SRC, weight: 1 }, vix)] : []),
    // La valutazione di lungo periodo ha più peso del P/E di un singolo anno.
    ...(spec.shiller ? [
      driverCape({ label: 'Valutazione di lungo periodo (CAPE)', source: SRC_SHILLER, weight: 2, signalCode: 'equities.cape' }, evidence?.cape ?? null, evidence?.capePct30y ?? null, '30 anni'),
      driverExcessYield({ label: 'Premio delle azioni sui bond', source: SRC_SHILLER, weight: 1.5 }, evidence?.ecy ?? null, evidence?.ecyPct30y ?? null, '30 anni'),
    ] : []),
  ]

  return synthesize({ key: spec.key, title: spec.title, drivers, asOf: Math.floor(Date.now() / 1000) })
}

export async function analyzeEquities(evidence: EquityEvidence | null = null): Promise<SectorAnalysis> {
  const vix = await getQuoteValue('^VIX')

  // Sequenziale con piccola pausa: molte chiamate Yahoo ravvicinate rischiano il throttle.
  const subMarkets: SectorAnalysis[] = []
  for (const spec of SUBS) {
    subMarkets.push(await analyzeSub(spec, vix, evidence))
    await sleep(400)
  }

  const drivers = subMarkets.map((s) => {
    const spec = SUBS.find((x) => x.key === s.key)!
    return driverFromSubMarket(s, spec.weight)
  })

  // Nota di contrasto: area più distesa vs più tesa.
  const ranked = [...subMarkets].sort((a, b) => b.score - a.score)
  const best = ranked[0]
  const worst = ranked[ranked.length - 1]
  const note = best && worst && best.key !== worst.key
    ? `Tra le aree, ${best.title} appare la più distesa, ${worst.title} la più tesa.`
    : undefined

  return synthesize({
    key: 'equities',
    title: 'Azionario',
    drivers,
    asOf: Math.floor(Date.now() / 1000),
    learnMore: LEARN,
    historicalNote: note,
    subMarkets,
  })
}
