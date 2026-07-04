'use server'

import { requireUser } from '@/lib/dal'
import { simulateSaleFifo } from '@/lib/taxSim'
import type { TaxSimResult } from '@/lib/taxSim'

/**
 * Server action per il simulatore di vendita FIFO nella pagina Tasse.
 * Identica alla versione in portfolios/[id]/actions.ts ma centralizzata qui.
 */
export async function simulateSaleAction(
  portfolioId:      number,
  instrumentId:     number,
  qtyToSell:        number,
  sellPricePerUnit: number,
): Promise<TaxSimResult> {
  const user = await requireUser()
  return simulateSaleFifo(user.id, portfolioId, instrumentId, qtyToSell, sellPricePerUnit)
}
