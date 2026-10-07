'use server'
// src/app/dashboard/mercati/actions.ts — Aggiornamento su richiesta della cache
// "Panorama Mercati". La cache è globale (uguale per tutti gli utenti) e ogni
// giro interroga una ventina di endpoint esterni: per non martellare le fonti
// si accetta al massimo un aggiornamento ogni 30 minuti per l'intera istanza.
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import { runMarketRefresh, readRefreshReport } from '@/lib/marketOverview/refresh'

const MIN_INTERVAL_S = 30 * 60

export interface RefreshState {
  ok:       boolean
  message:  string
}

export async function refreshMarketsAction(): Promise<RefreshState> {
  await requireUser()

  const last = readRefreshReport()
  const now = Math.floor(Date.now() / 1000)
  if (last && now - last.finishedAt < MIN_INTERVAL_S) {
    const mins = Math.ceil((MIN_INTERVAL_S - (now - last.finishedAt)) / 60)
    return { ok: false, message: `Dati aggiornati da poco: riprova tra ${mins} min.` }
  }

  try {
    const report = await runMarketRefresh()
    revalidatePath('/dashboard/mercati')
    return report.failures.length
      ? { ok: false, message: `Aggiornato in parte. Fonti che non hanno risposto: ${report.failures.join('; ')}.` }
      : { ok: true, message: 'Dati aggiornati.' }
  } catch (e) {
    console.error('[market] refresh manuale fallito:', e)
    return { ok: false, message: 'Aggiornamento non riuscito: le fonti esterne non rispondono. Riprova più tardi.' }
  }
}
