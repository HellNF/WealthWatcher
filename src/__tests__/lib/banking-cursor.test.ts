import { syncConnection } from '@/lib/banking/sync'
import { checkSession, getBalances, getTransactions } from '@/lib/banking/client'
import { listAccountsForConnection, markConnectionSynced, setConnectionStatus, setConnectionValidUntil } from '@/lib/banking/connections'
import type { BankAccount, EbConnection } from '@/db/schema'

jest.mock('@/lib/banking/client', () => ({ checkSession: jest.fn(), getBalances: jest.fn(), getTransactions: jest.fn() }))
jest.mock('@/lib/banking/connections', () => ({
  listAccountsForConnection: jest.fn(), markConnectionSynced: jest.fn(),
  setConnectionStatus: jest.fn(), setConnectionValidUntil: jest.fn(), decryptSessionId: () => 'session',
}))
jest.mock('@/lib/userSettings', () => ({ getEnableBankingKey: () => ({ appId: 'test', privateKey: 'test' }) }))
jest.mock('@/lib/transactions', () => ({ insertBatch: () => ({ insertedCount: 0, duplicateCount: 0 }) }))
jest.mock('@/lib/accountMerge', () => ({ autoMergeRenewalDuplicates: () => [] }))
const connection = { id: 7, owner_id: 1, valid_until: null, last_synced_at: 1793577600 } as EbConnection
const account = { id: 42, eb_account_uid: 'test', eb_account_key: 'key' } as BankAccount
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(listAccountsForConnection).mockReturnValue([account])
  jest.mocked(getBalances).mockResolvedValue([])
  jest.mocked(checkSession).mockResolvedValue({ kind: 'alive', validUntil: null })
})
test('errore movimenti: conserva il cursore precedente per recuperare lo storico', async () => {
  jest.mocked(getTransactions).mockResolvedValue(null)
  const result = await syncConnection(connection)
  expect(result.accounts[0].error).toBeDefined()
  expect(markConnectionSynced).not.toHaveBeenCalled()
})
test('tutti i conti completati: aggiorna il cursore', async () => {
  jest.mocked(getTransactions).mockResolvedValue([])
  await syncConnection(connection)
  expect(markConnectionSynced).toHaveBeenCalledWith(connection.id)
})
test('un conto fallito tra due impedisce di avanzare il cursore condiviso', async () => {
  jest.mocked(listAccountsForConnection).mockReturnValue([account, { ...account, id: 43 }])
  jest.mocked(getTransactions).mockResolvedValueOnce([]).mockResolvedValueOnce(null)
  const result = await syncConnection(connection)
  expect(result.accounts).toHaveLength(2)
  expect(markConnectionSynced).not.toHaveBeenCalled()
})

test('consenso revocato presso la banca: connessione scaduta, nessuna chiamata ai conti', async () => {
  jest.mocked(checkSession).mockResolvedValue({ kind: 'dead', reason: 'REVOKED' })
  const result = await syncConnection(connection)
  expect(result.status).toBe('expired')
  expect(setConnectionStatus).toHaveBeenCalledWith(connection.id, 'expired')
  expect(getTransactions).not.toHaveBeenCalled()
  expect(markConnectionSynced).not.toHaveBeenCalled()
})
test('stato sessione non verificabile: la sync prosegue', async () => {
  jest.mocked(checkSession).mockResolvedValue({ kind: 'unknown' })
  jest.mocked(getTransactions).mockResolvedValue([])
  const result = await syncConnection(connection)
  expect(result.status).toBe('synced')
  expect(setConnectionStatus).not.toHaveBeenCalled()
})
test('allinea la scadenza locale a quella restituita dalla banca', async () => {
  jest.mocked(checkSession).mockResolvedValue({ kind: 'alive', validUntil: 1800000000 })
  jest.mocked(getTransactions).mockResolvedValue([])
  await syncConnection(connection)
  expect(setConnectionValidUntil).toHaveBeenCalledWith(connection.id, 1800000000)
})
