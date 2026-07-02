import { Wallet, Home, Car, Package, type LucideIcon } from 'lucide-react'
import type { AssetKind } from '@/lib/assets'

export const ASSET_KINDS: { value: AssetKind; label: string; Icon: LucideIcon }[] = [
  { value: 'cash',        label: 'Liquidità', Icon: Wallet },
  { value: 'real_estate', label: 'Immobili',  Icon: Home },
  { value: 'vehicle',     label: 'Veicoli',   Icon: Car },
  { value: 'other',       label: 'Altro',     Icon: Package },
]

export const KIND_MAP: Record<string, { label: string; Icon: LucideIcon }> =
  Object.fromEntries(ASSET_KINDS.map((k) => [k.value, { label: k.label, Icon: k.Icon }]))
