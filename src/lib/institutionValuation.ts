// src/lib/institutionValuation.ts
// Valore totale in EUR di un'istituzione (saldi conti + valore di mercato dei
// portafogli), per una panoramica compatta sul dashboard. `stale` = qualche
// prezzo/cambio non era disponibile, quindi il totale è parziale.
import { listAccounts, getAccountBalanceMinor } from './accounts'
import { listPortfolios } from './portfolios'
import { getPortfolioValuationEur } from './portfolioValuation'
import { convertToEur } from './fx/convert'

export interface InstitutionValue {
  valueEurMinor: number
  stale: boolean
}

export async function getInstitutionValueEur(
  userId: number,
  institutionId: number,
  date: string,
): Promise<InstitutionValue> {
  let total = 0
  let stale = false

  for (const acc of listAccounts(userId, institutionId)) {
    const eur = await convertToEur(getAccountBalanceMinor(acc.id), acc.currency, date)
    if (eur === null) stale = true
    else total += eur
  }

  for (const p of listPortfolios(userId, institutionId)) {
    const v = await getPortfolioValuationEur(userId, p.id, date)
    if (v.marketValueEurMinor === null) stale = true
    else total += v.marketValueEurMinor
  }

  return { valueEurMinor: total, stale }
}
