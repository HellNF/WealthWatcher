// Append-only value history for generic assets (oggi solo veicoli).
// One row per (asset, date). "Last write wins" within the same day — modellata
// su src/lib/priceHistory.ts.
import { sqlite } from '@/db'
import { db } from '@/db'
import { assetValuations } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import type { AssetValuation } from '@/db/schema'

export function appendAssetValuation(
  assetId: number,
  date: string,        // ISO YYYY-MM-DD
  valueMinor: number,
  currency: string,
  source: string | null,
  sampleSize: number | null = null,
  confidence: string | null = null,
): void {
  sqlite.prepare(`
    INSERT INTO asset_valuations (asset_id, date, value_minor, currency, source, sample_size, confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (asset_id, date)
    DO UPDATE SET value_minor = excluded.value_minor, source = excluded.source, sample_size = excluded.sample_size, confidence = excluded.confidence
  `).run(assetId, date, valueMinor, currency, source, sampleSize, confidence)
}

// Storico completo di un asset, più recente per primo.
export function listAssetValuations(assetId: number): AssetValuation[] {
  return db
    .select()
    .from(assetValuations)
    .where(eq(assetValuations.asset_id, assetId))
    .orderBy(desc(assetValuations.date))
    .all()
}
