// src/__tests__/api/messages.test.ts
import { NextRequest } from 'next/server'
import { sqlite } from '@/db'
import { requireUser } from '@/lib/dal'

jest.mock('@/lib/dal', () => ({ requireUser: jest.fn() }))
const mockRequireUser = requireUser as jest.Mock

// Import dopo il mock: la route chiama requireUser() solo su POST.
import { GET, POST } from '@/app/api/messages/route'

const FAKE_USER = { id: 1, role: 'member' as const, name: 'Mario Rossi', email: 'mario@example.com' }

beforeEach(() => {
  sqlite.exec('DELETE FROM messages')
  mockRequireUser.mockReset()
})

function makeRequest(method: string, body?: object, params?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/messages')
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'content-type': 'application/json' } : undefined,
  })
}

test('GET restituisce array vuoto inizialmente (lettura pubblica, nessuna sessione richiesta)', async () => {
  const res = await GET(makeRequest('GET'))
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data).toEqual([])
})

test('POST senza sessione viene rifiutato con 401', async () => {
  mockRequireUser.mockRejectedValue(new Error('redirect'))
  const res = await POST(makeRequest('POST', { content: 'Test proposta' }))
  expect(res.status).toBe(401)
})

test('POST con sessione crea un messaggio con autore derivato dall\'utente', async () => {
  mockRequireUser.mockResolvedValue(FAKE_USER)
  const res = await POST(makeRequest('POST', { content: 'Test proposta' }))
  expect(res.status).toBe(201)
  const data = await res.json()
  expect(data.author).toBe('Mario Rossi')
  expect(data.content).toBe('Test proposta')
})

test('POST ignora un author fornito dal client e usa quello di sessione', async () => {
  mockRequireUser.mockResolvedValue(FAKE_USER)
  const res = await POST(makeRequest('POST', { author: 'Impostore', content: 'Test' }))
  const data = await res.json()
  expect(data.author).toBe('Mario Rossi')
})

test('POST rifiuta content mancante', async () => {
  mockRequireUser.mockResolvedValue(FAKE_USER)
  const res = await POST(makeRequest('POST', {}))
  expect(res.status).toBe(400)
})

test('GET con since filtra messaggi precedenti', async () => {
  // Use explicit timestamps to avoid flakiness with SQLite unixepoch 1-second resolution
  const oldTs = Math.floor(Date.now() / 1000) - 10
  const newTs = Math.floor(Date.now() / 1000)
  sqlite.prepare('INSERT INTO messages (author, content, created_at) VALUES (?, ?, ?)').run('Mario', 'Primo', oldTs)
  sqlite.prepare('INSERT INTO messages (author, content, created_at) VALUES (?, ?, ?)').run('Nicol', 'Secondo', newTs)

  const filtered = await GET(makeRequest('GET', undefined, { since: String(oldTs) }))
  const data = await filtered.json()
  expect(data).toHaveLength(1)
  expect(data[0].content).toBe('Secondo')
})

test('GET con since non valido restituisce 400', async () => {
  const res = await GET(makeRequest('GET', undefined, { since: 'notanumber' }))
  expect(res.status).toBe(400)
})

test('POST rifiuta content più lungo di 1000 caratteri', async () => {
  mockRequireUser.mockResolvedValue(FAKE_USER)
  const res = await POST(makeRequest('POST', { content: 'x'.repeat(1001) }))
  expect(res.status).toBe(400)
})

test('POST tronca l\'autore a 50 caratteri se il nome utente è molto lungo', async () => {
  mockRequireUser.mockResolvedValue({ ...FAKE_USER, name: 'N'.repeat(80) })
  const res = await POST(makeRequest('POST', { content: 'Test' }))
  const data = await res.json()
  expect(data.author).toHaveLength(50)
})
