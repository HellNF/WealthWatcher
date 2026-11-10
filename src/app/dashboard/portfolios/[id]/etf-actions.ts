'use server'
import { requireUser } from '@/lib/dal'
import { listTxns } from '@/lib/investmentTxns'
import { getInstrument } from '@/lib/instruments'
import { refreshEtf } from '@/lib/prices/justetf'
export async function loadEtfAction(portfolioId: number, instrumentId: number) {
  const user = await requireUser()
  if (!listTxns(user.id, portfolioId).some(t => t.instrument_id === instrumentId)) return { error: 'Strumento non disponibile nel portafoglio' }
  const instrument = getInstrument(instrumentId)
  if (instrument?.cluster !== 'etf' || !instrument.isin) return { error: 'Serve un ETF con ISIN verificabile' }
  try { return { profile: await refreshEtf(instrument.isin.toUpperCase()) } }
  catch (error) { return { error: error instanceof Error ? error.message : 'Dati justETF non disponibili' } }
}
