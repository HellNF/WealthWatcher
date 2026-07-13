// src/app/dashboard/assets-parse.ts
//
// Parsing/validazione del form asset — separato da assets-actions.ts perché
// quel file ha 'use server': ogni suo export deve essere una Server Action
// async, e questa è una funzione pura sincrona (oltre a essere comodo poterla
// testare in isolamento, senza tirarsi dietro l'intera catena requireUser →
// next-auth).
import { z } from 'zod'
import type { AssetKind, VehicleDetailsInput, Drivetrain } from '@/lib/assets'
import { toMinor } from '@/lib/money'
import type { FuelType, GearboxType, Country } from '@/lib/prices/autoscout24'

const KINDS: [AssetKind, ...AssetKind[]] = ['cash', 'real_estate', 'vehicle', 'other']
const FUEL_TYPES: [FuelType, ...FuelType[]] = ['petrol', 'diesel', 'electric', 'hybrid', 'lpg']
const GEARBOX_TYPES: [GearboxType, ...GearboxType[]] = ['manual', 'automatic']
const COUNTRIES: [Country, ...Country[]] = ['AT', 'BE', 'DE', 'ES', 'FR', 'IT', 'LU', 'NL']
const DRIVETRAIN_TYPES: [Drivetrain, ...Drivetrain[]] = ['fwd', 'rwd', 'awd']
const CURRENT_YEAR = new Date().getFullYear()

export interface ParsedFields {
  name: string
  kind: AssetKind
  valueMinor: number
  currency: string
  vehicle?: VehicleDetailsInput
}

// Zod valida struttura/tipo/enum/range dei campi grezzi (tutti stringhe, da
// FormData); la conversione in minor units (toMinor, che può lanciare per
// valori fuori scala) resta fuori dallo schema e viene gestita subito dopo,
// con lo stesso comportamento di prima.
const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v)

const formSchema = z.object({
  name:     z.string().trim().min(1, 'Nome obbligatorio').max(100, 'Nome troppo lungo'),
  kind:     z.enum(KINDS, { message: 'Tipo non valido' }),
  currency: z.string().trim().toUpperCase().length(3, 'Valuta non valida (codice ISO a 3 lettere)'),
  rawValue: z.string().trim().min(1, 'Valore non valido').refine((v) => !isNaN(Number(v.replace(',', '.'))), 'Valore non valido'),

  // Campi veicolo — obbligatori solo quando kind === 'vehicle' (validati sotto).
  vehicleMake:  z.string().trim(),
  vehicleModel: z.string().trim(),
  vehicleYear:  z.string().trim(),
  vehicleMileage: z.string().trim(),
  vehicleAnnualKm: z.string().trim(),
  vehiclePurchasePrice: z.string().trim(),
  vehiclePowerHp: z.string().trim(),
  vehicleDisplacementCc: z.string().trim(),
  vehicleFuel: z.preprocess(emptyToUndefined, z.enum(FUEL_TYPES, { message: 'Alimentazione non valida' }).optional()),
  vehicleGearbox: z.preprocess(emptyToUndefined, z.enum(GEARBOX_TYPES, { message: 'Cambio non valido' }).optional()),
  vehicleCountry: z.string().trim().toUpperCase().pipe(z.enum(COUNTRIES, { message: 'Paese di ricerca non valido' })),
  vehicleDrivetrain: z.preprocess(emptyToUndefined, z.enum(DRIVETRAIN_TYPES, { message: 'Trazione non valida' }).optional()),
  vehicleAutoEstimate: z.boolean(),
})

type FormInput = z.infer<typeof formSchema>

function readFormData(formData: FormData): z.input<typeof formSchema> {
  return {
    name:     String(formData.get('name') ?? ''),
    kind:     String(formData.get('kind') ?? 'cash') as AssetKind,
    currency: String(formData.get('currency') ?? 'EUR'),
    rawValue: String(formData.get('value') ?? ''),

    vehicleMake:  String(formData.get('vehicle_make') ?? ''),
    vehicleModel: String(formData.get('vehicle_model') ?? ''),
    vehicleYear:  String(formData.get('vehicle_year') ?? ''),
    vehicleMileage: String(formData.get('vehicle_mileage') ?? ''),
    vehicleAnnualKm: String(formData.get('vehicle_annual_km') ?? ''),
    vehiclePurchasePrice: String(formData.get('vehicle_purchase_price') ?? ''),
    vehiclePowerHp: String(formData.get('vehicle_power_hp') ?? ''),
    vehicleDisplacementCc: String(formData.get('vehicle_displacement_cc') ?? ''),
    vehicleFuel: String(formData.get('vehicle_fuel') ?? ''),
    vehicleGearbox: String(formData.get('vehicle_gearbox') ?? ''),
    vehicleCountry: String(formData.get('vehicle_country') ?? 'IT'),
    vehicleDrivetrain: String(formData.get('vehicle_drivetrain') ?? ''),
    vehicleAutoEstimate: formData.get('vehicle_auto_estimate') === 'on',
  }
}

/** Interi opzionali: stringa vuota → null, altrimenti valida finito/vincolo. */
function parseOptionalInt(raw: string, predicate: (n: number) => boolean, errorMsg: string): number | null | { error: string } {
  if (raw === '') return null
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || !predicate(n)) return { error: errorMsg }
  return n
}

export function parseAssetForm(formData: FormData): ParsedFields | { error: string } {
  const result = formSchema.safeParse(readFormData(formData))
  if (!result.success) return { error: result.error.issues[0]?.message ?? 'Dati non validi' }
  const input: FormInput = result.data

  let valueMinor: number
  try {
    valueMinor = toMinor(Number(input.rawValue.replace(',', '.')).toFixed(2), input.currency)
  } catch {
    return { error: 'Valore fuori scala' }
  }

  if (input.kind !== 'vehicle') {
    return { name: input.name, kind: input.kind, currency: input.currency, valueMinor }
  }

  // Campi extra veicolo — obbligatori solo quando kind === 'vehicle'.
  if (!input.vehicleMake) return { error: 'Marca obbligatoria per un veicolo' }
  if (!input.vehicleModel) return { error: 'Modello obbligatorio per un veicolo' }

  const year = parseInt(input.vehicleYear, 10)
  if (!Number.isFinite(year) || year < 1950 || year > CURRENT_YEAR + 1) return { error: 'Anno non valido' }

  const mileageKm = parseInt(input.vehicleMileage, 10)
  if (!Number.isFinite(mileageKm) || mileageKm < 0) return { error: 'Chilometraggio non valido' }

  const annualKm = parseOptionalInt(input.vehicleAnnualKm, (n) => n >= 0, 'Km/anno non validi')
  if (annualKm !== null && typeof annualKm === 'object') return annualKm

  // Prezzo pagato — solo per il confronto in UI, nella stessa valuta dell'asset
  // (nessun campo valuta separato). Non influisce mai sul patrimonio netto.
  let purchasePriceMinor: number | null = null
  if (input.vehiclePurchasePrice !== '') {
    if (isNaN(Number(input.vehiclePurchasePrice))) return { error: 'Prezzo di acquisto non valido' }
    try {
      purchasePriceMinor = toMinor(Number(input.vehiclePurchasePrice).toFixed(2), input.currency)
    } catch {
      return { error: 'Prezzo di acquisto fuori scala' }
    }
    if (purchasePriceMinor < 0) return { error: 'Prezzo di acquisto non valido' }
  }

  const powerHp = parseOptionalInt(input.vehiclePowerHp, (n) => n > 0, 'Potenza non valida')
  if (powerHp !== null && typeof powerHp === 'object') return powerHp

  const displacementCc = parseOptionalInt(input.vehicleDisplacementCc, (n) => n > 0, 'Cilindrata non valida')
  if (displacementCc !== null && typeof displacementCc === 'object') return displacementCc

  return {
    name: input.name, kind: input.kind, currency: input.currency, valueMinor,
    vehicle: {
      make: input.vehicleMake, model: input.vehicleModel, year, mileageKm,
      annualKm, autoEstimate: input.vehicleAutoEstimate, powerHp, displacementCc, purchasePriceMinor,
      fuel:       input.vehicleFuel ?? null,
      gearbox:    input.vehicleGearbox ?? null,
      country:    input.vehicleCountry,
      drivetrain: input.vehicleDrivetrain ?? null,
    },
  }
}
