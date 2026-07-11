'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import {
  createAsset, updateAsset, deleteAsset, getAssetForUser,
  getVehicleDetails, upsertVehicleDetails, deleteVehicleDetails,
  type AssetKind, type VehicleDetailsInput, type Drivetrain,
} from '@/lib/assets'
import { refreshNetWorth } from '@/lib/valuation'
import { refreshVehicleEstimate } from '@/lib/prices/vehicleEstimate'
import { toMinor } from '@/lib/money'
import type { FuelType, GearboxType, Country } from '@/lib/prices/autoscout24'

type State = { error?: string } | undefined

const KINDS: AssetKind[] = ['cash', 'real_estate', 'vehicle', 'other']
const FUEL_TYPES: FuelType[] = ['petrol', 'diesel', 'electric', 'hybrid', 'lpg']
const GEARBOX_TYPES: GearboxType[] = ['manual', 'automatic']
const COUNTRIES: Country[] = ['AT', 'BE', 'DE', 'ES', 'FR', 'IT', 'LU', 'NL']
const DRIVETRAIN_TYPES: Drivetrain[] = ['fwd', 'rwd', 'awd']
const CURRENT_YEAR = new Date().getFullYear()

interface ParsedFields {
  name: string
  kind: AssetKind
  valueMinor: number
  currency: string
  vehicle?: VehicleDetailsInput
}

function parse(formData: FormData): ParsedFields | { error: string } {
  const name = String(formData.get('name') ?? '').trim()
  const kind = String(formData.get('kind') ?? 'cash') as AssetKind
  const currency = String(formData.get('currency') ?? 'EUR').trim().toUpperCase()
  const rawValue = String(formData.get('value') ?? '').trim().replace(',', '.')

  if (!name) return { error: 'Nome obbligatorio' }
  if (name.length > 100) return { error: 'Nome troppo lungo' }
  if (!KINDS.includes(kind)) return { error: 'Tipo non valido' }
  if (currency.length !== 3) return { error: 'Valuta non valida (codice ISO a 3 lettere)' }
  if (rawValue === '' || isNaN(Number(rawValue))) return { error: 'Valore non valido' }

  let valueMinor: number
  try {
    valueMinor = toMinor(Number(rawValue).toFixed(2), currency)
  } catch {
    return { error: 'Valore fuori scala' }
  }

  if (kind !== 'vehicle') return { name, kind, currency, valueMinor }

  // Campi extra veicolo — obbligatori solo quando kind === 'vehicle'
  const make = String(formData.get('vehicle_make') ?? '').trim()
  const model = String(formData.get('vehicle_model') ?? '').trim()
  const year = parseInt(String(formData.get('vehicle_year') ?? ''), 10)
  const mileageKm = parseInt(String(formData.get('vehicle_mileage') ?? ''), 10)
  const rawAnnualKm = String(formData.get('vehicle_annual_km') ?? '').trim()
  const rawPurchasePrice = String(formData.get('vehicle_purchase_price') ?? '').trim().replace(',', '.')
  const rawPowerHp = String(formData.get('vehicle_power_hp') ?? '').trim()
  const rawDisplacementCc = String(formData.get('vehicle_displacement_cc') ?? '').trim()
  const fuel = String(formData.get('vehicle_fuel') ?? '').trim()
  const gearbox = String(formData.get('vehicle_gearbox') ?? '').trim()
  const country = String(formData.get('vehicle_country') ?? 'IT').trim().toUpperCase()
  const drivetrain = String(formData.get('vehicle_drivetrain') ?? '').trim()
  const autoEstimate = formData.get('vehicle_auto_estimate') === 'on'

  if (!make) return { error: 'Marca obbligatoria per un veicolo' }
  if (!model) return { error: 'Modello obbligatorio per un veicolo' }
  if (!Number.isFinite(year) || year < 1950 || year > CURRENT_YEAR + 1) return { error: 'Anno non valido' }
  if (!Number.isFinite(mileageKm) || mileageKm < 0) return { error: 'Chilometraggio non valido' }
  if (fuel && !FUEL_TYPES.includes(fuel as FuelType)) return { error: 'Alimentazione non valida' }
  if (gearbox && !GEARBOX_TYPES.includes(gearbox as GearboxType)) return { error: 'Cambio non valido' }
  if (!COUNTRIES.includes(country as Country)) return { error: 'Paese di ricerca non valido' }
  if (drivetrain && !DRIVETRAIN_TYPES.includes(drivetrain as Drivetrain)) return { error: 'Trazione non valida' }

  let annualKm: number | null = null
  if (rawAnnualKm !== '') {
    annualKm = parseInt(rawAnnualKm, 10)
    if (!Number.isFinite(annualKm) || annualKm < 0) return { error: 'Km/anno non validi' }
  }

  // Prezzo pagato — solo per il confronto in UI, nella stessa valuta dell'asset
  // (nessun campo valuta separato). Non influisce mai sul patrimonio netto.
  let purchasePriceMinor: number | null = null
  if (rawPurchasePrice !== '') {
    if (isNaN(Number(rawPurchasePrice))) return { error: 'Prezzo di acquisto non valido' }
    try {
      purchasePriceMinor = toMinor(Number(rawPurchasePrice).toFixed(2), currency)
    } catch {
      return { error: 'Prezzo di acquisto fuori scala' }
    }
    if (purchasePriceMinor < 0) return { error: 'Prezzo di acquisto non valido' }
  }

  let powerHp: number | null = null
  if (rawPowerHp !== '') {
    powerHp = parseInt(rawPowerHp, 10)
    if (!Number.isFinite(powerHp) || powerHp <= 0) return { error: 'Potenza non valida' }
  }

  let displacementCc: number | null = null
  if (rawDisplacementCc !== '') {
    displacementCc = parseInt(rawDisplacementCc, 10)
    if (!Number.isFinite(displacementCc) || displacementCc <= 0) return { error: 'Cilindrata non valida' }
  }

  return {
    name, kind, currency, valueMinor,
    vehicle: {
      make, model, year, mileageKm, annualKm, autoEstimate, powerHp, displacementCc, purchasePriceMinor,
      fuel:       fuel ? (fuel as FuelType) : null,
      gearbox:    gearbox ? (gearbox as GearboxType) : null,
      country:    country as Country,
      drivetrain: drivetrain ? (drivetrain as Drivetrain) : null,
    },
  }
}

export async function addAssetAction(_prev: State, formData: FormData): Promise<State> {
  const user = await requireUser()
  const parsed = parse(formData)
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
  const parsed = parse(formData)
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
