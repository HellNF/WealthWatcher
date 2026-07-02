// src/__tests__/lib/assets.test.ts
// Altri beni: CRUD + ownership + inclusione nel patrimonio netto.
import { sqlite } from '@/db'
import {
  listAssets, createAsset, updateAsset, deleteAsset, getAssetForUser, getAssetsValueEur,
} from '@/lib/assets'
import { computeNetWorth } from '@/lib/valuation'

let userId: number
const OTHER = 987654

beforeAll(() => {
  sqlite.prepare(`INSERT INTO users (email, name, role) VALUES ('assets@example.com', 'A', 'member')`).run()
  userId = (sqlite.prepare(`SELECT id FROM users WHERE email = 'assets@example.com'`).get() as { id: number }).id
})

afterEach(() => {
  sqlite.prepare(`DELETE FROM assets WHERE owner_id = ?`).run(userId)
})

afterAll(() => {
  sqlite.prepare(`DELETE FROM valuation_snapshots WHERE owner_id = ?`).run(userId)
  sqlite.prepare(`DELETE FROM users WHERE id = ?`).run(userId)
})

describe('assets CRUD + ownership', () => {
  test('create / list / get', () => {
    const a = createAsset(userId, { name: 'Contanti', kind: 'cash', valueMinor: 50000, currency: 'EUR' })
    expect(a.id).toBeGreaterThan(0)
    expect(listAssets(userId)).toHaveLength(1)
    expect(getAssetForUser(userId, a.id)!.name).toBe('Contanti')
    expect(getAssetForUser(OTHER, a.id)).toBeUndefined()
  })

  test('update valore (owner) e blocco altri utenti', () => {
    const a = createAsset(userId, { name: 'Auto', kind: 'vehicle', valueMinor: 800000, currency: 'EUR' })
    expect(updateAsset(userId, a.id, { valueMinor: 750000 })).toBe(true)
    expect(getAssetForUser(userId, a.id)!.value_minor).toBe(750000)
    expect(updateAsset(OTHER, a.id, { valueMinor: 1 })).toBe(false)
    expect(getAssetForUser(userId, a.id)!.value_minor).toBe(750000)
  })

  test('delete (owner) e blocco altri utenti', () => {
    const a = createAsset(userId, { name: 'X', kind: 'other', valueMinor: 100, currency: 'EUR' })
    expect(deleteAsset(OTHER, a.id)).toBe(false)
    expect(deleteAsset(userId, a.id)).toBe(true)
    expect(getAssetForUser(userId, a.id)).toBeUndefined()
  })
})

describe('getAssetsValueEur (EUR, nessun cambio necessario)', () => {
  test('somma i beni in EUR', async () => {
    createAsset(userId, { name: 'Contanti', kind: 'cash', valueMinor: 50000, currency: 'EUR' })
    createAsset(userId, { name: 'Casa', kind: 'real_estate', valueMinor: 25000000, currency: 'EUR' })
    const { eurMinor, stale } = await getAssetsValueEur(userId, '2024-01-01')
    expect(eurMinor).toBe(25050000)
    expect(stale).toBe(false)
  })
})

describe('computeNetWorth include gli altri beni', () => {
  test('senza conti/portafogli, net worth = somma beni', async () => {
    createAsset(userId, { name: 'Contanti', kind: 'cash', valueMinor: 50000, currency: 'EUR' })
    createAsset(userId, { name: 'Auto', kind: 'vehicle', valueMinor: 800000, currency: 'EUR' })
    const r = await computeNetWorth(userId, '2024-01-01')
    expect(r.otherAssetsEurMinor).toBe(850000)
    expect(r.netWorthEurMinor).toBe(850000)
    expect(r.breakdown.otherAssets).toHaveLength(2)
  })

  test('valore negativo (debito) riduce il patrimonio', async () => {
    createAsset(userId, { name: 'Contanti', kind: 'cash', valueMinor: 100000, currency: 'EUR' })
    createAsset(userId, { name: 'Mutuo', kind: 'other', valueMinor: -30000, currency: 'EUR' })
    const r = await computeNetWorth(userId, '2024-01-01')
    expect(r.otherAssetsEurMinor).toBe(70000)
  })
})
