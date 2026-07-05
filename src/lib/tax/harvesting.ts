// src/lib/tax/harvesting.ts — Engine di raccomandazione Tax-Loss Harvesting.
//
// Genera suggerimenti azionabili incrociando:
//   A) EXTEND_EXPIRY: crediti fiscali in scadenza × posizioni con plusvalenza latente
//      → vendere e riacquistare l'asset per usare il credito prima che scada
//   B) GENERATE_CREDIT: posizioni con minusvalenza latente
//      → vendere e riacquistare per cristallizzare la perdita come credito 4 anni
//
// Soglia di materialità: €10 di beneficio fiscale minimo (evita suggerimenti microscopici).
// Non produce mai raccomandazioni se il beneficio atteso è irrisorio rispetto alle commissioni.
import { dec } from '@/lib/money'
import { listPortfolios } from '@/lib/portfolios'
import { getPortfolioPositions } from '@/lib/positions'
import { listInstruments } from '@/lib/instruments'
import { convertToEur } from '@/lib/fx/convert'
import { computeFiscalWallet } from './wallet'
import { syntheticRate, incomeType } from './rates'

// ── Tipi pubblici ─────────────────────────────────────────────────────────────

export interface HarvestingRecommendation {
  type:             'EXTEND_EXPIRY' | 'GENERATE_CREDIT'
  portfolioId:      number
  portfolioName:    string
  instrumentId:     number
  assetName:        string
  ticker:           string
  /** Quantità residua totale della posizione */
  remainingQty:     string
  /** Quantità suggerita da vendere (e riacquistare) */
  suggestedQty:     string
  /** Plus/minus latente in EUR minor (firmato: negativo = perdita) */
  latentPlEurMinor: number
  /** Beneficio fiscale: tasse risparmiate (A) o credito futuro (B), in EUR minor */
  taxImpactMinor:   number
  appliedRate:      number
  /** Per EXTEND_EXPIRY: porzione di credito in scadenza che verrebbe assorbita */
  expiringCreditConsumedMinor: number
  actionText:       string
}

// ── Costanti ─────────────────────────────────────────────────────────────────

/** Beneficio fiscale minimo in EUR minor (€10) per generare una raccomandazione */
const MATERIALITY_MINOR = 1_000

// ── Helper ────────────────────────────────────────────────────────────────────

function fmtEur(minor: number): string {
  return (Math.abs(minor) / 100).toLocaleString('it-IT', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
  })
}

/** Arrotonda la quantità suggerita a 2 decimali, al rialzo per coprire il target */
function roundQtyUp(qty: number): string {
  return (Math.ceil(qty * 100) / 100).toFixed(2).replace(/\.00$/, '')
}

// ── Funzione principale ───────────────────────────────────────────────────────

/**
 * Genera raccomandazioni di Tax-Loss Harvesting per l'utente.
 *
 * Ordine output: EXTEND_EXPIRY prima (urgenti per scadenza anno), poi GENERATE_CREDIT
 * per impatto fiscale decrescente. Massimo 6 suggerimenti totali.
 *
 * Non lancia eccezioni: errori FX vengono ignorati silenziosamente (posizione saltata).
 */
export async function generateHarvestingRecommendations(
  userId: number,
): Promise<HarvestingRecommendation[]> {
  const today       = new Date().toISOString().slice(0, 10)
  const currentYear = today.slice(0, 4)

  const wallet      = computeFiscalWallet(userId)
  const portfolios  = listPortfolios(userId)
  const instrMap    = new Map(listInstruments().map(i => [i.id, i]))

  // ── Raccolta posizioni aperte con P/L in EUR ────────────────────────────────
  interface Entry {
    portfolioId:   number
    portfolioName: string
    instrumentId:  number
    assetName:     string
    ticker:        string
    remainingQty:  string
    gainEurMinor:  number   // firmato: negativo = perdita
    rate:          number   // syntheticRate per quell'asset
    cluster:       string
  }

  const entries: Entry[] = []

  for (const portfolio of portfolios) {
    const { positions } = getPortfolioPositions(userId, portfolio.id)

    for (const pos of positions) {
      if (pos.unrealizedPlMinor === null) continue
      if (dec(pos.remainingQty).lte(0)) continue

      let gainEurMinor: number | null
      if (pos.currency === 'EUR') {
        gainEurMinor = pos.unrealizedPlMinor
      } else {
        gainEurMinor = await convertToEur(pos.unrealizedPlMinor, pos.currency, today).catch(() => null)
      }
      if (gainEurMinor === null) continue

      const instr = instrMap.get(pos.instrumentId)
      if (!instr) continue

      entries.push({
        portfolioId:   portfolio.id,
        portfolioName: portfolio.name,
        instrumentId:  pos.instrumentId,
        assetName:     pos.name,
        ticker:        pos.symbol,
        remainingQty:  pos.remainingQty,
        gainEurMinor,
        rate:          syntheticRate(instr.whitelist_percentage),
        cluster:       instr.cluster,
      })
    }
  }

  const recommendations: HarvestingRecommendation[] = []

  // ── Scenario A: EXTEND_EXPIRY ─────────────────────────────────────────────
  // Usa i crediti in scadenza vendendo (e riacquistando) posizioni in plusvalenza "diverso".
  // Posizioni ETF in gain = "capitale", non assorbono crediti → escluse.
  if (wallet.expiringThisYearMinor > 0) {
    let remainingExpiring = wallet.expiringThisYearMinor

    const gainCandidates = entries
      .filter(e => e.gainEurMinor > 0 && incomeType(e.cluster, e.gainEurMinor) === 'diverse')
      .sort((a, b) => b.gainEurMinor - a.gainEurMinor)  // priorità ai guadagni più grandi

    for (const e of gainCandidates) {
      if (remainingExpiring <= 0) break

      const creditConsumed = Math.min(remainingExpiring, e.gainEurMinor)
      const taxSaved       = Math.round(creditConsumed * e.rate)
      if (taxSaved < MATERIALITY_MINOR) continue

      // Quante quote vendere per generare esattamente creditConsumed di plusvalenza
      const remainingQtyNum = parseFloat(e.remainingQty)
      const gainPerUnit     = e.gainEurMinor / remainingQtyNum
      const rawQty          = creditConsumed / gainPerUnit
      const suggestedQty    = Math.min(Math.ceil(rawQty * 100) / 100, remainingQtyNum)

      const cryptoNote = e.cluster === 'crypto'
        ? ' (considera che i guadagni cripto sono esenti sotto la franchigia di €2.000)'
        : ''

      const actionText =
        `Hai ${fmtEur(wallet.expiringThisYearMinor)} di crediti fiscali in scadenza il 31/12/${currentYear}. ` +
        `La tua posizione su ${e.assetName} ha una plusvalenza latente di ${fmtEur(e.gainEurMinor)}${cryptoNote}. ` +
        `Vendendo ${roundQtyUp(suggestedQty)} quote di ${e.ticker} e riacquistandole subito dopo, ` +
        `utilizzeresti ${fmtEur(creditConsumed)} di credito in scadenza, ` +
        `risparmiando ${fmtEur(taxSaved)} di imposte che altrimenti andrebbero perse.`

      recommendations.push({
        type:                        'EXTEND_EXPIRY',
        portfolioId:                 e.portfolioId,
        portfolioName:               e.portfolioName,
        instrumentId:                e.instrumentId,
        assetName:                   e.assetName,
        ticker:                      e.ticker,
        remainingQty:                e.remainingQty,
        suggestedQty:                roundQtyUp(suggestedQty),
        latentPlEurMinor:            e.gainEurMinor,
        taxImpactMinor:              taxSaved,
        appliedRate:                 e.rate,
        expiringCreditConsumedMinor: creditConsumed,
        actionText,
      })

      remainingExpiring -= creditConsumed
    }
  }

  // ── Scenario B: GENERATE_CREDIT ───────────────────────────────────────────
  // Cristallizza perdite latenti come nuovo credito fiscale 4 anni.
  // Le minusvalenze da QUALSIASI asset (inclusi ETF) sono sempre "redditi diversi".
  const lossCandidates = entries
    .filter(e => e.gainEurMinor < 0)
    .sort((a, b) => a.gainEurMinor - b.gainEurMinor)  // perdite maggiori prima

  for (const e of lossCandidates) {
    const lossEurMinor    = Math.abs(e.gainEurMinor)
    const futureTaxBonus  = Math.round(lossEurMinor * e.rate)
    if (futureTaxBonus < MATERIALITY_MINOR) continue

    const cryptoNote = e.cluster === 'crypto'
      ? ' (utilizzabile solo su plusvalenze cripto future che superino la franchigia di €2.000)'
      : ''

    const actionText =
      `La tua posizione su ${e.assetName} ha una minusvalenza latente di ${fmtEur(lossEurMinor)}. ` +
      `Vendendo tutte le ${e.remainingQty} quote di ${e.ticker} e riacquistandole subito, ` +
      `genereresti un credito fiscale di ${fmtEur(lossEurMinor)} valido per 4 anni${cryptoNote}, ` +
      `con un potenziale risparmio futuro di ${fmtEur(futureTaxBonus)} su plusvalenze future.`

    recommendations.push({
      type:                        'GENERATE_CREDIT',
      portfolioId:                 e.portfolioId,
      portfolioName:               e.portfolioName,
      instrumentId:                e.instrumentId,
      assetName:                   e.assetName,
      ticker:                      e.ticker,
      remainingQty:                e.remainingQty,
      suggestedQty:                e.remainingQty,
      latentPlEurMinor:            e.gainEurMinor,
      taxImpactMinor:              futureTaxBonus,
      appliedRate:                 e.rate,
      expiringCreditConsumedMinor: 0,
      actionText,
    })
  }

  // EXTEND_EXPIRY prima (urgenza scadenza anno), poi GENERATE_CREDIT per impatto decrescente
  recommendations.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'EXTEND_EXPIRY' ? -1 : 1
    return b.taxImpactMinor - a.taxImpactMinor
  })

  return recommendations.slice(0, 6)
}
