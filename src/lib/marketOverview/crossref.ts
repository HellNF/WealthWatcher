// src/lib/marketOverview/crossref.ts — Incrocio tra la composizione reale del
// portafoglio (allocation.ts) e le SINTESI di settore (analysis). Mette in
// relazione due fatti oggettivi ("sei al X% azionario" + "il contesto azionario
// è teso") e si ferma lì: contesto educativo, mai un ordine.
import type { AllocationResult, Cluster } from './allocation'
import type { SectorAnalysis, Stance } from './analysis/types'

export interface CrossInsight {
  id:   string
  text: string
  tone: 'neutral' | 'attention'
}

function pctOf(allocation: AllocationResult, ...clusters: Cluster[]): number {
  return allocation.byCluster
    .filter((c) => clusters.includes(c.cluster))
    .reduce((s, c) => s + c.pct, 0)
}

function fmtPct(n: number): string {
  return `${Math.round(n)}%`
}

const CAUTIOUS: Stance[] = ['caution', 'lean-caution']
const FAVORABLE: Stance[] = ['accumulate', 'lean-accumulate']

function bySector(analyses: SectorAnalysis[], key: string): SectorAnalysis | undefined {
  return analyses.find((a) => a.key === key)
}

/**
 * Righe contestuali che legano la composizione dell'utente alle stance di
 * settore. Restituisce [] se non c'è nessuna coincidenza notevole.
 */
export function buildCrossInsights(
  allocation: AllocationResult,
  analyses:   SectorAnalysis[],
): CrossInsight[] {
  const out: CrossInsight[] = []
  const equityPct = pctOf(allocation, 'stock', 'etf')
  const bondPct   = pctOf(allocation, 'bond')
  const cryptoPct = pctOf(allocation, 'crypto')

  const eq = bySector(analyses, 'equities')
  const bo = bySector(analyses, 'bonds')
  const cr = bySector(analyses, 'crypto')

  // 1. Alta esposizione azionaria mentre il contesto azionario è teso.
  if (eq && equityPct >= 50 && CAUTIOUS.includes(eq.stance)) {
    out.push({
      id:   'equity-high-exposure',
      tone: 'attention',
      text: `La tua quota azionario/ETF è ${fmtPct(equityPct)} e il contesto azionario è valutato "${eq.headline.toLowerCase()}". Fasi come questa storicamente hanno offerto meno margine a nuovi ingressi ai massimi — spunto di riflessione, non un'indicazione.`,
    })
  }

  // 2. Contesto obbligazionario favorevole ma quota bond bassa.
  if (bo && FAVORABLE.includes(bo.stance) && bondPct < 15) {
    out.push({
      id:   'bonds-favorable-low-exposure',
      tone: 'neutral',
      text: `Il contesto obbligazionario euro è valutato "${bo.headline.toLowerCase()}", mentre la tua quota obbligazionaria è ${fmtPct(bondPct)}. Con rendimenti reali positivi le obbligazioni offrono più reddito che negli anni scorsi.`,
    })
  }

  // 3. Quota crypto rilevante in un contesto teso.
  if (cr && cryptoPct >= 10 && CAUTIOUS.includes(cr.stance)) {
    out.push({
      id:   'crypto-caution',
      tone: 'attention',
      text: `La tua quota crypto è ${fmtPct(cryptoPct)} e il contesto è valutato "${cr.headline.toLowerCase()}". Le fasi di euforia storicamente precedono più volatilità.`,
    })
  }

  return out
}
