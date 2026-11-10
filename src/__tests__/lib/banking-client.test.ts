import { getTransactions } from '@/lib/banking/client'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'

jest.mock('@/lib/banking/jwt', () => ({ getEnableBankingJwt: () => 'test-jwt' }))
jest.mock('@/lib/fetchWithTimeout', () => ({ fetchWithTimeout: jest.fn() }))
const fetchMock = jest.mocked(fetchWithTimeout)
const creds = { appId: 'test-app', privateKey: 'test-key' }
const page = (transactions: unknown[], continuation_key?: string) => new Response(JSON.stringify({ transactions, continuation_key }))

beforeEach(() => { fetchMock.mockReset() })
test('segue tutte le pagine e richiede solo movimenti contabilizzati', async () => {
  fetchMock.mockResolvedValueOnce(page([{ entry_reference: 'a' }], 'next'))
    .mockResolvedValueOnce(page([{ entry_reference: 'b' }]))
  expect(await getTransactions(creds, 'account', '2026-11-01')).toHaveLength(2)
  const url = new URL(String(fetchMock.mock.calls[1][0]))
  expect(url.searchParams.get('transaction_status')).toBe('BOOK')
  expect(url.searchParams.get('continuation_key')).toBe('next')
  expect(url.searchParams.get('date_from')).toBe('2026-11-01')
})
test('una pagina fallita invalida il download completo', async () => {
  fetchMock.mockResolvedValueOnce(page([{ entry_reference: 'a' }], 'next'))
    .mockResolvedValueOnce(new Response('', { status: 500 }))
  expect(await getTransactions(creds, 'account')).toBeNull()
})
test('interrompe un cursore ripetuto', async () => {
  fetchMock.mockImplementation(async () => page([], 'same'))
  expect(await getTransactions(creds, 'account')).toBeNull()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
test('il limite di pagine non restituisce un successo parziale', async () => {
  let n = 0
  fetchMock.mockImplementation(async () => page([], `page-${++n}`))
  expect(await getTransactions(creds, 'account')).toBeNull()
  expect(fetchMock).toHaveBeenCalledTimes(50)
})
test('una risposta malformata non viene considerata uno storico vuoto', async () => {
  fetchMock.mockResolvedValueOnce(new Response('{}'))
  expect(await getTransactions(creds, 'account')).toBeNull()
})
