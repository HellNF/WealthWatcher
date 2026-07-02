// src/lib/assets.ts — Altri beni (liquidità, immobili, veicoli, altro).
// Concorrono al patrimonio netto. Owner-scoped (nessuna condivisione per ora).
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { assets } from '@/db/schema'
import { convertToEur } from '@/lib/fx/convert'
import type { Asset } from '@/db/schema'

export type AssetKind = 'cash' | 'real_estate' | 'vehicle' | 'other'
export type { Asset }

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
