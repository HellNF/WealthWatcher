// src/lib/assets.ts — Altri beni (liquidità, immobili, veicoli, altro).
// Concorrono al patrimonio netto. Owner-scoped (nessuna condivisione per ora).
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { assets, vehicleDetails } from '@/db/schema'
import { convertToEur } from '@/lib/fx/convert'
import type { Asset, VehicleDetails } from '@/db/schema'
import type { FuelType, GearboxType, Country, Confidence } from '@/lib/prices/autoscout24'

export type AssetKind = 'cash' | 'real_estate' | 'vehicle' | 'other'
// Solo informativo — non è filtrabile su AutoScout24 (vedi nota in prices/autoscout24.ts).
export type Drivetrain = 'fwd' | 'rwd' | 'awd'
export type { Asset, VehicleDetails }

export function listAssets(userId: number): Asset[] {
  return db
    .select()
    .from(assets)
    .where(eq(assets.owner_id, userId))
    .orderBy(desc(assets.created_at), desc(assets.id))
    .all()
}

export function getAssetForUser(userId: number, id: number): Asset | undefined {
  return db
    .select()
    .from(assets)
    .where(and(eq(assets.id, id), eq(assets.owner_id, userId)))
    .get()
}

export function createAsset(
  userId: number,
  fields: { name: string; kind: AssetKind; valueMinor: number; currency: string; note?: string | null },
): Asset {
  return db
    .insert(assets)
    .values({
      owner_id:    userId,
      name:        fields.name,
      kind:        fields.kind,
      value_minor: fields.valueMinor,
      currency:    fields.currency,
      note:        fields.note ?? null,
    })
    .returning()
    .get() as Asset
}

export function updateAsset(
  userId: number,
  id: number,
  fields: { name?: string; kind?: AssetKind; valueMinor?: number; currency?: string; note?: string | null },
): boolean {
  const patch: Record<string, unknown> = { updated_at: Math.floor(Date.now() / 1000) }
  if (fields.name !== undefined)      patch.name = fields.name
  if (fields.kind !== undefined)      patch.kind = fields.kind
  if (fields.valueMinor !== undefined) patch.value_minor = fields.valueMinor
  if (fields.currency !== undefined)  patch.currency = fields.currency
  if (fields.note !== undefined)      patch.note = fields.note

  const res = db
    .update(assets)
    .set(patch)
    .where(and(eq(assets.id, id), eq(assets.owner_id, userId)))
    .run()
  return res.changes > 0
}

export function deleteAsset(userId: number, id: number): boolean {
  const res = db
    .delete(assets)
    .where(and(eq(assets.id, id), eq(assets.owner_id, userId)))
    .run()
  return res.changes > 0
}

// ── vehicle_details ───────────────────────────────────────────────────────────
// Dati identificativi 1:1 con un asset di kind 'vehicle'. Nessun ownership check
// qui: il chiamante deve già aver verificato che l'asset appartenga all'utente
// (es. via getAssetForUser) prima di leggere/scrivere questi dati.

export interface VehicleDetailsInput {
  make:         string
  model:        string
  year:         number
  fuel?:        FuelType | null
  gearbox?:     GearboxType | null
  powerHp?:     number | null
  displacementCc?: number | null
  country:      Country
  drivetrain?:  Drivetrain | null
  mileageKm:    number
  annualKm?:    number | null
  autoEstimate?: boolean
  purchasePriceMinor?: number | null  // prezzo pagato, minor units nella valuta dell'asset
}

export function getVehicleDetails(assetId: number): VehicleDetails | undefined {
  return db
    .select()
    .from(vehicleDetails)
    .where(eq(vehicleDetails.asset_id, assetId))
    .get()
}

// Upsert manuale (nessuna colonna unique oltre alla PK asset_id, quindi INSERT ...
// ON CONFLICT DO UPDATE via Drizzle onConflictDoUpdate).
export function upsertVehicleDetails(assetId: number, fields: VehicleDetailsInput): void {
  const values = {
    asset_id:     assetId,
    make:         fields.make,
    model:        fields.model,
    year:         fields.year,
    fuel:         fields.fuel ?? null,
    gearbox:      fields.gearbox ?? null,
    power_hp:     fields.powerHp ?? null,
    displacement_cc: fields.displacementCc ?? null,
    country:      fields.country,
    drivetrain:   fields.drivetrain ?? null,
    mileage_km:   fields.mileageKm,
    annual_km:    fields.annualKm ?? null,
    purchase_price_minor: fields.purchasePriceMinor ?? null,
    auto_estimate: fields.autoEstimate === false ? 0 : 1,
    updated_at:   Math.floor(Date.now() / 1000),
  }
  db
    .insert(vehicleDetails)
    .values(values)
    .onConflictDoUpdate({ target: vehicleDetails.asset_id, set: values })
    .run()
}

export function deleteVehicleDetails(assetId: number): void {
  db.delete(vehicleDetails).where(eq(vehicleDetails.asset_id, assetId)).run()
}

// Aggiorna solo i metadati dell'ultima stima automatica riuscita, senza toccare
// `updated_at`/`mileage_km` — quel campo resta l'ancora per l'estrapolazione del
// chilometraggio (vedi currentMileage in prices/vehicleEstimate.ts) e deve
// muoversi solo quando l'utente aggiorna i km a mano, non ad ogni refresh.
export function markVehicleEstimated(assetId: number, atEpoch: number, source: string, confidence: Confidence | null = null): void {
  db
    .update(vehicleDetails)
    .set({ last_estimate_at: atEpoch, last_estimate_source: source, last_estimate_confidence: confidence })
    .where(eq(vehicleDetails.asset_id, assetId))
    .run()
}

// Somma di tutti i beni convertita in EUR. `stale` = qualche cambio mancante.
export async function getAssetsValueEur(
  userId: number,
  date: string,
): Promise<{ eurMinor: number; stale: boolean }> {
  let total = 0
  let stale = false
  for (const a of listAssets(userId)) {
    const eur = await convertToEur(a.value_minor, a.currency, date)
    if (eur === null) stale = true
    else total += eur
  }
  return { eurMinor: total, stale }
}
