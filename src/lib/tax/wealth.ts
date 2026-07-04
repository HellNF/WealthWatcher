// src/lib/tax/wealth.ts — Stima annuale delle imposte patrimoniali (bollo conti + IVAFE).
// Derivato a runtime dalle posizioni correnti: nessuna tabella persistita (coerente con Fase 1).
//
// Normativa:
//  - Imposta di bollo conti (IT): €34,20/anno fissi se giacenza media > €5.000 (Art. 13 c. 2-bis DPR 642/1972)
//  - Imposta di bollo titoli (IT): 0,2% del controvalore prodotti finanziari al 31/12
//  - IVAFE conti esteri: €34,20/anno fissi se giacenza media > €5.000 (Art. 19 c. 18 DL 201/2011)
//  - IVAFE titoli esteri: 0,2% del controvalore (con conversione storica BCE)
//
// Il regime (bollo vs IVAFE) è determinato da institutions.country:
//  null/'IT' = italiano → bollo; qualsiasi altro codice ISO alpha-2 = estero → IVAFE.
import { dec } from '@/lib/money'
import { listAccounts, accountAverageBalanceMinor } from '@/lib/accounts'
import { listInstitutions } from '@/lib/institutions'
import { listPortfolios } from '@/lib/portfolios'
import { getPortfolioPositions } from '@/lib/positions'
import { convertToEur } from '@/lib/fx/convert'
import {
  stampDutyAccountMinor,
  wealthDutySecuritiesMinor,
  isForeign,
} from './rates'

// ── Tipi pubblici ─────────────────────────────────────────────────────────────

/** Una riga dell'imposta patrimoniale: un conto o un portafoglio. */
export interface WealthTaxLine {
  kind:           'account' | 'portfolio'
  id:             number
  name:           string
  /** 'bollo' = intermediario italiano; 'ivafe' = intermediario estero */
  regime:         'bollo' | 'ivafe'
  /** Giacenza media (conti) o controvalore (portafogli), in EUR minor */
  baseEurMinor:   number
  /** Imposta stimata: 0 se sotto soglia (conti) o se nessun valore (portafogli) */
  taxEurMinor:    number
  /** true se la conversione valuta non era disponibile (stima parziale) */
  stale:          boolean
}

export interface WealthTaxStats {
  year:              string
  lines:             WealthTaxLine[]
  totalBolloMinor:   number  // bollo su conti+titoli italiani
  totalIvafeMinor:   number  // IVAFE su conti+titoli esteri
  totalMinor:        number  // totalBolloMinor + totalIvafeMinor
  /** true se qualche cambio BCE non era disponibile → almeno una stima parziale */
  stale:             boolean
}

// ── Funzione principale ───────────────────────────────────────────────────────

/**
 * Stima le imposte patrimoniali annue per l'utente.
 *
 * Per i conti: giacenza media ricostruita dai movimenti (pro-rata bollo).
 * Per i portafogli: controvalore corrente delle posizioni aperte (convertito in EUR via BCE).
 *
 * Non nasconde errori in catch{}: i fallimenti di conversione FX sono marcati con `stale = true`
 * sulla riga corrispondente, in linea con il pattern di computeNetWorth/latentTaxStats.
 *
 * @param userId  id utente autenticato
 * @param year    anno 4 cifre, es. '2026'
 */
export async function estimatedWealthTaxes(userId: number, year: string): Promise<WealthTaxStats> {
  const today = new Date().toISOString().slice(0, 10)

  // Mappa istituzione → paese per determinare il regime fiscale
  const institutionMap = new Map(
    listInstitutions(userId).map(inst => [inst.id, inst]),
  )

  const lines: WealthTaxLine[] = []
  let totalBolloMinor = 0
  let totalIvafeMinor = 0
  let anyStale        = false

  // ── Conti correnti ─────────────────────────────────────────────────────────
  const accounts = listAccounts(userId)
  for (const acc of accounts) {
    const institution = institutionMap.get(acc.institution_id)
    const regime: 'bollo' | 'ivafe' = isForeign(institution?.country) ? 'ivafe' : 'bollo'

    const { giacenzaMediaMinor, fractionOfYear } = accountAverageBalanceMinor(acc.id, year)

    // Converti in EUR se il conto è in valuta estera
    let giacenzaEurMinor: number
    let stale = false
    if (acc.currency === 'EUR') {
      giacenzaEurMinor = giacenzaMediaMinor
    } else {
      const converted = await convertToEur(giacenzaMediaMinor, acc.currency, `${year}-12-31`)
      if (converted === null) {
        // Fallback al tasso odierno (potrebbe essere assente → salta con stale)
        const fallback = await convertToEur(giacenzaMediaMinor, acc.currency, today)
        if (fallback === null) {
          stale = true
          anyStale = true
          giacenzaEurMinor = giacenzaMediaMinor  // impreciso ma non blocca
        } else {
          giacenzaEurMinor = fallback
          stale = true
          anyStale = true
        }
      } else {
        giacenzaEurMinor = converted
      }
    }

    const taxEurMinor = stampDutyAccountMinor(giacenzaEurMinor, fractionOfYear)

    lines.push({
      kind: 'account',
      id:   acc.id,
      name: acc.name,
      regime,
      baseEurMinor: giacenzaEurMinor,
      taxEurMinor,
      stale,
    })

    if (regime === 'bollo') totalBolloMinor += taxEurMinor
    else                    totalIvafeMinor += taxEurMinor
  }

  // ── Portafogli d'investimento ───────────────────────────────────────────────
  const portfolios = listPortfolios(userId)
  for (const portfolio of portfolios) {
    const institution = institutionMap.get(portfolio.institution_id)
    const regime: 'bollo' | 'ivafe' = isForeign(institution?.country) ? 'ivafe' : 'bollo'

    const { positions } = getPortfolioPositions(userId, portfolio.id)

    let portfolioEurMinor = 0
    let stale = false

    for (const pos of positions) {
      if (pos.marketValueMinor === null) { stale = true; anyStale = true; continue }
      if (dec(pos.remainingQty).lte(0)) continue

      if (pos.currency === 'EUR') {
        portfolioEurMinor += pos.marketValueMinor
      } else {
        const converted = await convertToEur(pos.marketValueMinor, pos.currency, `${year}-12-31`)
        if (converted === null) {
          const fallback = await convertToEur(pos.marketValueMinor, pos.currency, today)
          if (fallback === null) {
            stale = true; anyStale = true
          } else {
            portfolioEurMinor += fallback
            stale = true; anyStale = true
          }
        } else {
          portfolioEurMinor += converted
        }
      }
    }

    const taxEurMinor = wealthDutySecuritiesMinor(portfolioEurMinor)

    lines.push({
      kind: 'portfolio',
      id:   portfolio.id,
      name: portfolio.name,
      regime,
      baseEurMinor: portfolioEurMinor,
      taxEurMinor,
      stale,
    })

    if (regime === 'bollo') totalBolloMinor += taxEurMinor
    else                    totalIvafeMinor += taxEurMinor
  }

  return {
    year,
    lines,
    totalBolloMinor,
    totalIvafeMinor,
    totalMinor: totalBolloMinor + totalIvafeMinor,
    stale: anyStale,
  }
}
