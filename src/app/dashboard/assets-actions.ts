'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import {
  createAsset, updateAsset, deleteAsset, getAssetForUser,
  getVehicleDetails, upsertVehicleDetails, deleteVehicleDetails,
} from '@/lib/assets'
import { refreshNetWorth } from '@/lib/valuation'
import { refreshVehicleEstimate } from '@/lib/prices/vehicleEstimate'
import { parseAssetForm } from './assets-parse'

type State = { error?: string } | undefined

export async function addAssetAction(_prev: State, formData: FormData): Promise<State> {
  const user = await requireUser()
  const parsed = parseAssetForm(formData)
  if ('error' in parsed) return parsed

  const asset = createAsset(user.id, parsed)
  if (parsed.vehicle) upsertVehicleDetails(asset.id, parsed.vehicle)
  await refreshNetWorth(user.id)
  revalidatePath('/dashboard')
  return undefined
}

export async function updateAssetAction(
  assetId: number,
  _prev: State,
  formData: FormData,
): Promise<State> {
  const user = await requireUser()
  const parsed = parseAssetForm(formData)
  if ('error' in parsed) return parsed

  const ok = updateAsset(user.id, assetId, parsed)
  if (!ok) return { error: 'Bene non trovato' }

  if (parsed.vehicle) upsertVehicleDetails(assetId, parsed.vehicle)
  else deleteVehicleDetails(assetId) // kind cambiato via da 'vehicle' — ripulisce i dati orfani

  await refreshNetWorth(user.id)
  revalidatePath('/dashboard')
  return undefined
}

export async function deleteAssetAction(assetId: number): Promise<void> {
  const user = await requireUser()
  deleteAsset(user.id, assetId)
  await refreshNetWorth(user.id)
  revalidatePath('/dashboard')
}

// Refresh on-demand della stima veicolo (bottone "Aggiorna stima" in UI).
// force:true ignora il TTL — l'utente ha chiesto esplicitamente un refresh ora.
export async function refreshVehicleEstimateAction(assetId: number): Promise<State> {
  const user = await requireUser()
  const asset = getAssetForUser(user.id, assetId)
  if (!asset || asset.kind !== 'vehicle') return { error: 'Veicolo non trovato' }

  const details = getVehicleDetails(assetId)
  if (!details) return { error: 'Dati veicolo mancanti' }

  const result = await refreshVehicleEstimate(asset, details, { force: true })
  await refreshNetWorth(user.id)
  revalidatePath('/dashboard')

  if (result.stale) return { error: 'Stima non disponibile al momento — riprova più tardi' }
  return undefined
}
