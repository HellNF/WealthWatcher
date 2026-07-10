// Costanti condivise tra AddAssetForm e AssetRow per i campi extra dei veicoli.
import type { FuelType, GearboxType, Country } from '@/lib/prices/autoscout24'
import type { Drivetrain } from '@/lib/assets'

export const FUEL_OPTIONS: { value: FuelType; label: string }[] = [
  { value: 'petrol',   label: 'Benzina' },
  { value: 'diesel',   label: 'Diesel' },
  { value: 'electric', label: 'Elettrica' },
  { value: 'hybrid',   label: 'Ibrida' },
  { value: 'lpg',      label: 'GPL' },
]

export const GEARBOX_OPTIONS: { value: GearboxType; label: string }[] = [
  { value: 'manual',    label: 'Manuale' },
  { value: 'automatic', label: 'Automatico' },
]

// Mercati coperti dalla ricerca comparabili su AutoScout24 (i prezzi variano molto
// da un paese all'altro, es. Germania più economica dell'Italia a parità di auto).
export const COUNTRY_OPTIONS: { value: Country; label: string }[] = [
  { value: 'IT', label: 'Italia' },
  { value: 'DE', label: 'Germania' },
  { value: 'FR', label: 'Francia' },
  { value: 'ES', label: 'Spagna' },
  { value: 'AT', label: 'Austria' },
  { value: 'BE', label: 'Belgio' },
  { value: 'NL', label: 'Paesi Bassi' },
  { value: 'LU', label: 'Lussemburgo' },
]

// Solo informativo — non incide sulla ricerca comparabili (vedi autoscout24.ts).
export const DRIVETRAIN_OPTIONS: { value: Drivetrain; label: string }[] = [
  { value: 'fwd', label: 'Trazione anteriore' },
  { value: 'rwd', label: 'Trazione posteriore' },
  { value: 'awd', label: 'Trazione integrale (4x4)' },
]
