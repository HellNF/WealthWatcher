// src/lib/prices/vehicleEstimate.ts — Refresh orchestration per la stima veicolo.
// Specchio di src/lib/prices/index.ts (refreshInstrumentPrice): TTL lazy, aggiorna
// il valore dell'asset + appende storico su successo, marca "stale" su fallimento.
// Non lancia mai eccezioni — l'adapter sottostante già garantisce questa proprietà.
import { estimateVehicleValue, type FuelType, type GearboxType, type Country, type Confidence } from './autoscout24'
import { updateAsset, markVehicleEstimated } from '@/lib/assets'
import { appendAssetValuation } from '@/lib/assetValuations'
import type { Asset, VehicleDetails } from '@/db/schema'

const TTL_MINUTES = parseInt(process.env.VEHICLE_ESTIMATE_TTL_MINUTES ?? '1440', 10) // default: giornaliero

export interface VehicleRefreshResult {
  valueMinor:  number             // valore corrente dell'asset (aggiornato o invariato)
  stale:       boolean            // true se il fetch non è avvenuto o è fallito
  sampleSize:  number | null      // n. comparabili usati, solo se è stato effettivamente rifetchato
  confidence:  Confidence | null  // quanto fidarsi del valore, solo se è stato effettivamente rifetchato
}

/**
 * Estrapola il chilometraggio corrente da mileage_km + annual_km * tempo trascorso
 * dall'ultimo aggiornamento manuale (vehicle_details.updated_at). Se annual_km non
 * è impostato, nessuna estrapolazione: si usa mileage_km così com'è.
 */
function currentMileage(details: VehicleDetails): number {
  if (!details.annual_km) return details.mileage_km
  const monthsElapsed = (Date.now() / 1000 - details.updated_at) / (30 * 24 * 3600)
  const extraKm = Math.round((details.annual_km / 12) * monthsElapsed)
  return details.mileage_km + Math.max(0, extraKm)
}

/**
 * Rifetcha la stima di valore di un veicolo se scaduta (o forzata) e persiste il
 * risultato. Ritorna sempre il valore corrente dell'asset, con `stale: true` se
 * non è stato possibile ottenere una stima fresca (fetch fallito o TTL non ancora
 * scaduto senza force — in quel caso `stale: false` perché il valore è comunque
 * valido, semplicemente non è stato ricontrollato ora).
 */
export async function refreshVehicleEstimate(
  asset: Asset,
  details: VehicleDetails,
  options: { force?: boolean } = {},
): Promise<VehicleRefreshResult> {
  if (!details.auto_estimate && !options.force) {
    return { valueMinor: asset.value_minor, stale: false, sampleSize: null, confidence: null }
  }

  const nowEpoch = Math.floor(Date.now() / 1000)
  const ttlSeconds = TTL_MINUTES * 60
  const isStale = !details.last_estimate_at || nowEpoch - details.last_estimate_at > ttlSeconds

  if (!options.force && !isStale) {
    return { valueMinor: asset.value_minor, stale: false, sampleSize: null, confidence: null }
  }

  const estimate = await estimateVehicleValue({
    make:      details.make,
    model:     details.model,
    year:      details.year,
    fuel:      details.fuel as FuelType | null,
    gearbox:   details.gearbox as GearboxType | null,
    powerHp:        details.power_hp,
    displacementCc: details.displacement_cc,
    country:        details.country as Country,
    mileageKm: currentMileage(details),
    // drivetrain volutamente escluso — non filtrabile su AutoScout24 (vedi autoscout24.ts)
  })

  if (!estimate) {
    // Fetch fallito (sito bloccato/cambiato, o nessun livello della cascata di
    // rilassamento ha trovato un campione sufficiente) — il valore dell'asset
    // resta quello dell'ultima stima riuscita.
    return { valueMinor: asset.value_minor, stale: true, sampleSize: null, confidence: null }
  }

  updateAsset(asset.owner_id, asset.id, { valueMinor: estimate.valueMinor })
  const today = new Date().toISOString().slice(0, 10)
  appendAssetValuation(asset.id, today, estimate.valueMinor, estimate.currency, 'autoscout24', estimate.sampleSize, estimate.confidence)
  markVehicleEstimated(asset.id, nowEpoch, 'autoscout24', estimate.confidence)

  return { valueMinor: estimate.valueMinor, stale: false, sampleSize: estimate.sampleSize, confidence: estimate.confidence }
}
