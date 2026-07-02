'use server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import { createAsset, updateAsset, deleteAsset, type AssetKind } from '@/lib/assets'
import { takeSnapshot } from '@/lib/valuation'
import { toMinor } from '@/lib/money'

type State = { error?: string } | undefined

const KINDS: AssetKind[] = ['cash', 'real_estate', 'vehicle', 'other']

// Aggiorna lo snapshot di oggi così il patrimonio netto riflette subito la
// modifica (il grafico storico usa lo stesso snapshot). Non blocca la mutazione;
// un fallimento (es. FX) viene loggato, non silenziato.
async function refreshNetWorth(userId: number) {
  try {
    await takeSnapshot(userId)
  } catch (e) {
    console.error('[assets] refreshNetWorth', e)
  }
}

interface ParsedFields {
  name: string
  kind: AssetKind
  valueMinor: number
  currency: string
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

  try {
    return { name, kind, currency, valueMinor: toMinor(Number(rawValue).toFixed(2), currency) }
  } catch {
    return { error: 'Valore fuori scala' }
  }
}

export async function addAssetAction(_prev: State, formData: FormData): Promise<State> {
  const user = await requireUser()
  const parsed = parse(formData)
  if ('error' in parsed) return parsed

  createAsset(user.id, parsed)
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
