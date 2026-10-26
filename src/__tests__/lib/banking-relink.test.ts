// src/__tests__/lib/banking-relink.test.ts — Rinnovo di un consenso Open
// Banking scaduto: la banca restituisce uid nuovi per gli stessi conti, che
// devono ricollegarsi al bank_account esistente (stesso storico) invece di
// crearne uno nuovo. Più la fusione manuale dei doppioni già creati.
import { sqlite } from '@/db'
import { createInstitution, deleteInstitution } from '@/lib/institutions'
import { mergeAccounts, listMergeCandidates } from '@/lib/accounts'
import { autoMergeRenewalDuplicates } from '@/lib/accountMerge'
import {
  activateConnection, createPendingConnection, ebAccountKey, linkOrCreateAccount, setConnectionStatus,
} from '@/lib/banking/connections'

let userId: number
let otherUserId: number

beforeAll(() => {
  sqlite.prepare(`INSERT INTO users (email, name, role) VALUES ('eb-relink-test@example.com', 'Test', 'member')`).run()
  sqlite.prepare(`INSERT INTO users (email, name, role) VALUES ('eb-relink-other@example.com', 'Altro', 'member')`).run()
  userId      = (sqlite.prepare(`SELECT id FROM users WHERE email = 'eb-relink-test@example.com'`).get() as { id: number }).id
  otherUserId = (sqlite.prepare(`SELECT id FROM users WHERE email = 'eb-relink-other@example.com'`).get() as { id: number }).id
})

afterAll(() => {
  sqlite.prepare(`DELETE FROM users WHERE id IN (?, ?)`).run(userId, otherUserId)
})

function newConnection(institutionId: number) {
  const c = createPendingConnection(userId, institutionId, 'Test ASPSP', 'IT', new Date(Date.now() + 86_400_000))
  activateConnection(c.id, `session-${c.id}`)
  return c
}

function countAccounts(institutionId: number): number {
  return (sqlite.prepare(`SELECT COUNT(*) AS n FROM bank_accounts WHERE institution_id = ?`).get(institutionId) as { n: number }).n
}

function addTxn(accountId: number, hash: string, date = '2026-07-01', amount = -500) {
  sqlite
    .prepare(
      `INSERT INTO transactions (owner_id, bank_account_id, booked_date, amount_minor, currency, description_raw, dedup_hash)
       VALUES (?, ?, ?, ?, 'EUR', 'Test', ?)`,
    )
    .run(userId, accountId, date, amount, hash)
}

describe('ebAccountKey', () => {
  test('preferisce identification_hash', () => {
    expect(ebAccountKey({ identification_hash: 'abc', account_id: { iban: 'IT60X0542811101000000123456' } })).toBe('abc')
  })

  test('ripiega su un hash dell\'IBAN normalizzato, mai l\'IBAN in chiaro', () => {
    const a = ebAccountKey({ account_id: { iban: 'IT60 X054 2811 1010 0000 0123 456' } })
    const b = ebAccountKey({ account_id: { iban: 'it60x0542811101000000123456' } })
    expect(a).toBe(b)
    expect(a).toMatch(/^iban:[0-9a-f]{64}$/)
    expect(a).not.toContain('0542811101')
  })

  test('null senza identificativi', () => {
    expect(ebAccountKey({})).toBeNull()
  })
})

describe('linkOrCreateAccount su consenso rinnovato', () => {
  test('stessa chiave, uid nuovo → ricollega il conto esistente', () => {
    const inst = createInstitution(userId, 'Banca Relink', 'bank')
    const c1 = newConnection(inst.id)
    const first = linkOrCreateAccount(userId, inst.id, c1.id, 'uid-old', 'Conto corrente', 'EUR', 'hash-1')
    addTxn(first.id, 'h-old')

    setConnectionStatus(c1.id, 'expired')
    const c2 = newConnection(inst.id)
    const second = linkOrCreateAccount(userId, inst.id, c2.id, 'uid-new', 'Conto corrente', 'EUR', 'hash-1')

    expect(second.id).toBe(first.id)
    expect(second.eb_connection_id).toBe(c2.id)
    expect(second.eb_account_uid).toBe('uid-new')
    expect(countAccounts(inst.id)).toBe(1)
    deleteInstitution(userId, inst.id)
  })

  test('chiave diversa → conto nuovo (secondo conto della stessa banca)', () => {
    const inst = createInstitution(userId, 'Banca Due Conti', 'bank')
    const c1 = newConnection(inst.id)
    linkOrCreateAccount(userId, inst.id, c1.id, 'uid-a', 'Conto', 'EUR', 'hash-a')
    linkOrCreateAccount(userId, inst.id, c1.id, 'uid-b', 'Conto', 'EUR', 'hash-b')
    expect(countAccounts(inst.id)).toBe(2)
    deleteInstitution(userId, inst.id)
  })

  test('conto collegato prima della chiave: stesso nome e valuta su connessione scaduta → ricollega', () => {
    const inst = createInstitution(userId, 'Banca Legacy', 'bank')
    const c1 = newConnection(inst.id)
    const legacy = linkOrCreateAccount(userId, inst.id, c1.id, 'uid-old', 'Conto Smart', 'EUR')
    expect(legacy.eb_account_key).toBeNull()

    setConnectionStatus(c1.id, 'expired')
    const c2 = newConnection(inst.id)
    const relinked = linkOrCreateAccount(userId, inst.id, c2.id, 'uid-new', 'Conto Smart', 'EUR', 'hash-legacy')
    expect(relinked.id).toBe(legacy.id)
    expect(relinked.eb_account_key).toBe('hash-legacy')
    deleteInstitution(userId, inst.id)
  })

  test('legacy ambiguo (due conti con lo stesso nome) → non indovina, crea un conto nuovo', () => {
    const inst = createInstitution(userId, 'Banca Ambigua', 'bank')
    const c1 = newConnection(inst.id)
    linkOrCreateAccount(userId, inst.id, c1.id, 'uid-1', 'Conto', 'EUR')
    linkOrCreateAccount(userId, inst.id, c1.id, 'uid-2', 'Conto', 'EUR')
    setConnectionStatus(c1.id, 'expired')
    const c2 = newConnection(inst.id)
    linkOrCreateAccount(userId, inst.id, c2.id, 'uid-3', 'Conto', 'EUR', 'hash-x')
    expect(countAccounts(inst.id)).toBe(3)
    deleteInstitution(userId, inst.id)
  })

  test('legacy su connessione ancora attiva → non viene sottratto', () => {
    const inst = createInstitution(userId, 'Banca Attiva', 'bank')
    const c1 = newConnection(inst.id)
    linkOrCreateAccount(userId, inst.id, c1.id, 'uid-1', 'Conto', 'EUR')
    const c2 = newConnection(inst.id)
    linkOrCreateAccount(userId, inst.id, c2.id, 'uid-2', 'Conto', 'EUR', 'hash-y')
    expect(countAccounts(inst.id)).toBe(2)
    deleteInstitution(userId, inst.id)
  })
})

describe('mergeAccounts', () => {
  test('sposta i movimenti, scarta i doppioni, eredita il collegamento attivo e il saldo più recente', () => {
    const inst = createInstitution(userId, 'Banca Merge', 'bank')
    const c1 = newConnection(inst.id)
    const old = linkOrCreateAccount(userId, inst.id, c1.id, 'uid-old', 'Conto', 'EUR')
    sqlite.prepare(`UPDATE bank_accounts SET anchor_balance_minor = 1000, anchor_date = '2026-07-01', interest_rate = '1.5' WHERE id = ?`).run(old.id)
    addTxn(old.id, 'h1', '2026-05-01')
    addTxn(old.id, 'h2', '2026-06-01')
    setConnectionStatus(c1.id, 'expired')

    const c2 = newConnection(inst.id)
    const dup = linkOrCreateAccount(userId, inst.id, c2.id, 'uid-new', 'Conto (nuovo)', 'EUR', 'hash-m')
    sqlite.prepare(`UPDATE bank_accounts SET anchor_balance_minor = 2000, anchor_date = '2026-10-25' WHERE id = ?`).run(dup.id)
    addTxn(dup.id, 'h2', '2026-06-01')   // sovrapposto: già nel conto vecchio
    addTxn(dup.id, 'h3', '2026-10-01')

    expect(listMergeCandidates(userId, old.id).map((c) => c.id)).toEqual([dup.id])

    const result = mergeAccounts(userId, old.id, dup.id)
    expect(result).toEqual({ movedCount: 1, duplicateCount: 1 })

    const merged = sqlite.prepare(`SELECT * FROM bank_accounts WHERE id = ?`).get(old.id) as Record<string, unknown>
    expect(merged.name).toBe('Conto')
    expect(merged.eb_connection_id).toBe(c2.id)
    expect(merged.eb_account_uid).toBe('uid-new')
    expect(merged.eb_account_key).toBe('hash-m')
    expect(merged.anchor_balance_minor).toBe(2000)
    expect(merged.anchor_date).toBe('2026-10-25')
    expect(merged.interest_rate).toBe('1.5')

    const hashes = (sqlite.prepare(`SELECT dedup_hash FROM transactions WHERE bank_account_id = ? ORDER BY dedup_hash`).all(old.id) as { dedup_hash: string }[]).map((r) => r.dedup_hash)
    expect(hashes).toEqual(['h1', 'h2', 'h3'])
    expect(sqlite.prepare(`SELECT 1 FROM bank_accounts WHERE id = ?`).get(dup.id)).toBeUndefined()
    deleteInstitution(userId, inst.id)
  })

  test('rifiuta conti di altri utenti, valute diverse o lo stesso conto', () => {
    const inst = createInstitution(userId, 'Banca Rifiuti', 'bank')
    const c = newConnection(inst.id)
    const a = linkOrCreateAccount(userId, inst.id, c.id, 'u-a', 'A', 'EUR', 'k-a')
    const usd = linkOrCreateAccount(userId, inst.id, c.id, 'u-b', 'B', 'USD', 'k-b')
    expect(mergeAccounts(userId, a.id, a.id)).toBeNull()
    expect(mergeAccounts(userId, a.id, usd.id)).toBeNull()
    expect(mergeAccounts(otherUserId, a.id, usd.id)).toBeNull()
    expect(countAccounts(inst.id)).toBe(2)
    deleteInstitution(userId, inst.id)
  })
})

describe('autoMergeRenewalDuplicates (doppioni già creati da rinnovi passati)', () => {
  // Riproduce lo stato prodotto dal vecchio linkOrCreateAccount: conto
  // originale sulla connessione scaduta, doppione sulla nuova, nessuna chiave.
  function renewalScenario(name: string) {
    const inst = createInstitution(userId, name, 'bank')
    const c1 = newConnection(inst.id)
    const old = linkOrCreateAccount(userId, inst.id, c1.id, 'uid-old', 'Conto', 'EUR')
    setConnectionStatus(c1.id, 'expired')
    const c2 = newConnection(inst.id)
    const dup = sqlite
      .prepare(`INSERT INTO bank_accounts (owner_id, institution_id, name, currency, eb_account_uid, eb_connection_id)
                VALUES (?, ?, 'Conto', 'EUR', 'uid-new', ?) RETURNING id`)
      .get(userId, inst.id, c2.id) as { id: number }
    return { inst, old, dupId: dup.id, c2 }
  }

  test('movimenti in comune → unisce nel conto originale', () => {
    const { inst, old, dupId, c2 } = renewalScenario('Banca Auto')
    for (const h of ['a1', 'a2', 'a3', 'a4']) addTxn(old.id, h)
    for (const h of ['a2', 'a3', 'a4', 'a5', 'a6']) addTxn(dupId, h)

    const merged = autoMergeRenewalDuplicates(sqlite, userId)
    expect(merged).toEqual([{ ownerId: userId, keptId: old.id, mergedId: dupId, result: { movedCount: 2, duplicateCount: 3 } }])
    const acc = sqlite.prepare(`SELECT eb_connection_id FROM bank_accounts WHERE id = ?`).get(old.id) as { eb_connection_id: number }
    expect(acc.eb_connection_id).toBe(c2.id)
    expect((sqlite.prepare(`SELECT COUNT(*) AS n FROM transactions WHERE bank_account_id = ?`).get(old.id) as { n: number }).n).toBe(6)
    expect(countAccounts(inst.id)).toBe(1)

    // Idempotente: un secondo giro non trova più niente.
    expect(autoMergeRenewalDuplicates(sqlite, userId)).toEqual([])
    deleteInstitution(userId, inst.id)
  })

  test('nessun movimento in comune e nessuna chiave → non unisce', () => {
    const { inst, old, dupId } = renewalScenario('Banca Senza Prove')
    addTxn(old.id, 'b1')
    addTxn(dupId, 'b2')
    expect(autoMergeRenewalDuplicates(sqlite, userId)).toEqual([])
    expect(countAccounts(inst.id)).toBe(2)
    deleteInstitution(userId, inst.id)
  })

  test('un solo movimento in comune su molti → prova insufficiente', () => {
    const { inst, old, dupId } = renewalScenario('Banca Coincidenza')
    for (const h of ['c1', 'c2', 'c3']) addTxn(old.id, h)
    for (const h of ['c3', 'c4', 'c5', 'c6']) addTxn(dupId, h)
    expect(autoMergeRenewalDuplicates(sqlite, userId)).toEqual([])
    deleteInstitution(userId, inst.id)
  })

  test('chiavi stabili diverse → mai unire, anche con movimenti in comune', () => {
    const { inst, old, dupId } = renewalScenario('Banca Chiavi')
    sqlite.prepare(`UPDATE bank_accounts SET eb_account_key = 'k-old' WHERE id = ?`).run(old.id)
    sqlite.prepare(`UPDATE bank_accounts SET eb_account_key = 'k-new' WHERE id = ?`).run(dupId)
    for (const h of ['d1', 'd2', 'd3']) { addTxn(old.id, h); addTxn(dupId, h) }
    expect(autoMergeRenewalDuplicates(sqlite, userId)).toEqual([])
    deleteInstitution(userId, inst.id)
  })

  test('originale ancora su connessione attiva → non unisce', () => {
    const inst = createInstitution(userId, 'Banca Due Attive', 'bank')
    const c1 = newConnection(inst.id)
    const a = linkOrCreateAccount(userId, inst.id, c1.id, 'u1', 'Conto', 'EUR')
    const c2 = newConnection(inst.id)
    const b = linkOrCreateAccount(userId, inst.id, c2.id, 'u2', 'Conto', 'EUR', 'k')
    for (const h of ['e1', 'e2', 'e3']) { addTxn(a.id, h); addTxn(b.id, h) }
    expect(autoMergeRenewalDuplicates(sqlite, userId)).toEqual([])
    deleteInstitution(userId, inst.id)
  })

  test('abbinamento ambiguo (due originali per lo stesso doppione) → non unisce', () => {
    const inst = createInstitution(userId, 'Banca Doppia Storia', 'bank')
    const c1 = newConnection(inst.id)
    const a = linkOrCreateAccount(userId, inst.id, c1.id, 'u1', 'Conto A', 'EUR')
    const b = linkOrCreateAccount(userId, inst.id, c1.id, 'u2', 'Conto B', 'EUR')
    setConnectionStatus(c1.id, 'expired')
    const c2 = newConnection(inst.id)
    const n = linkOrCreateAccount(userId, inst.id, c2.id, 'u3', 'Conto C', 'EUR', 'k')
    for (const h of ['f1', 'f2', 'f3']) { addTxn(a.id, h); addTxn(b.id, h); addTxn(n.id, h) }
    expect(autoMergeRenewalDuplicates(sqlite, userId)).toEqual([])
    deleteInstitution(userId, inst.id)
  })
})
