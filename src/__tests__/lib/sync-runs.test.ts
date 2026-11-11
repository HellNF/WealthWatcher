// Esito delle sync Open Banking: registrato sempre (anche su eccezione),
// esito per conto, pulizia delle esecuzioni vecchie, isolamento per utente.
import { sqlite } from '@/db'
import { syncConnection } from '@/lib/banking/sync'
import { runConnectionSync, listSyncRuns, latestSyncRun, summarizeSyncRun, outcomeOf } from '@/lib/banking/syncRuns'
import type { EbConnection } from '@/db/schema'

jest.mock('@/lib/banking/sync', () => ({ syncConnection: jest.fn() }))
const mocked = jest.mocked(syncConnection)

let userId: number, connection: EbConnection
const account = (accountId: number, error?: string) =>
  ({ accountId, insertedCount: error ? 0 : 3, duplicateCount: 1, balanceUpdated: !error, ...(error ? { error } : {}) })

beforeAll(() => {
  sqlite.exec(`
    INSERT OR IGNORE INTO allowed_emails (email, role) VALUES ('syncruns@example.com','member');
    INSERT OR IGNORE INTO users (email, role) VALUES ('syncruns@example.com','member');
  `)
  userId = (sqlite.prepare("SELECT id FROM users WHERE email='syncruns@example.com'").get() as { id: number }).id
  const inst = Number(sqlite.prepare(`INSERT INTO institutions (owner_id, name, kind) VALUES (?, 'Banca', 'bank')`).run(userId).lastInsertRowid)
  const id = Number(sqlite.prepare(
    `INSERT INTO eb_connections (owner_id, institution_id, aspsp_name, aspsp_country, status, state)
     VALUES (?, ?, 'Banca Test', 'IT', 'active', ?)`,
  ).run(userId, inst, `state-${Date.now()}`).lastInsertRowid)
  connection = sqlite.prepare('SELECT * FROM eb_connections WHERE id = ?').get(id) as EbConnection
})
afterEach(() => { sqlite.prepare('DELETE FROM sync_runs WHERE owner_id = ?').run(userId); mocked.mockReset() })

test('esito per conto: riuscita, parziale, non riuscita', () => {
  const base = { connectionId: 1, status: 'synced' as const }
  expect(outcomeOf({ ...base, accounts: [account(1), account(2)] })).toBe('ok')
  expect(outcomeOf({ ...base, accounts: [account(1), account(2, 'x')] })).toBe('partial')
  expect(outcomeOf({ ...base, accounts: [account(1, 'x')] })).toBe('failed')
  expect(outcomeOf({ connectionId: 1, status: 'expired', accounts: [] })).toBe('expired')
})

test('una sync parziale viene registrata con conteggi ed errori per conto', async () => {
  mocked.mockResolvedValue({ connectionId: connection.id, status: 'synced',
    accounts: [account(10), account(11, 'Impossibile recuperare i movimenti da Enable Banking')] })
  await runConnectionSync(connection, 'scheduled')
  const [run] = listSyncRuns(userId, connection.id)
  expect(run).toMatchObject({
    trigger: 'scheduled', outcome: 'partial', insertedCount: 3, duplicateCount: 2,
    error: 'Impossibile recuperare i movimenti da Enable Banking',
  })
  expect(summarizeSyncRun(run, new Map([[11, 'Revolut']]))).toMatchObject({
    label: 'riuscita in parte', trigger: 'programmata', detail: '3 nuovi movimenti · errori su: Revolut',
  })
})

test('un consenso scaduto viene registrato con il motivo', async () => {
  mocked.mockResolvedValue({ connectionId: connection.id, status: 'expired', accounts: [] })
  await runConnectionSync(connection, 'manual')
  expect(latestSyncRun(userId, connection.id)).toMatchObject({ outcome: 'expired', error: expect.stringContaining('ricollega') })
})

test('un’eccezione viene registrata come non riuscita e poi rilanciata', async () => {
  mocked.mockRejectedValue(new Error('dettaglio interno da non mostrare'))
  await expect(runConnectionSync(connection, 'scheduled')).rejects.toThrow('dettaglio interno')
  const run = latestSyncRun(userId, connection.id)!
  expect(run.outcome).toBe('failed')
  expect(run.error).not.toContain('dettaglio interno')
})

test('conserva solo le ultime 30 esecuzioni e solo per il proprietario', async () => {
  mocked.mockResolvedValue({ connectionId: connection.id, status: 'synced', accounts: [account(10)] })
  for (let i = 0; i < 33; i++) await runConnectionSync(connection, 'scheduled')
  expect(listSyncRuns(userId, connection.id, 100)).toHaveLength(30)
  expect(listSyncRuns(userId + 999, connection.id)).toEqual([])
})
