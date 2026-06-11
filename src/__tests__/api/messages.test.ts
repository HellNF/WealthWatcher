// src/__tests__/api/messages.test.ts
import { GET, POST } from '@/app/api/messages/route'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

beforeEach(() => {
  db.exec('DELETE FROM messages')
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

test('GET restituisce array vuoto inizialmente', async () => {
  const res = await GET(makeRequest('GET'))
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data).toEqual([])
})

test('POST crea un messaggio e lo restituisce', async () => {
  const res = await POST(makeRequest('POST', { author: 'Mario', content: 'Test proposta' }))
  expect(res.status).toBe(201)
  const data = await res.json()
  expect(data.author).toBe('Mario')
  expect(data.content).toBe('Test proposta')
})

test('POST rifiuta author mancante', async () => {
  const res = await POST(makeRequest('POST', { content: 'Testo' }))
  expect(res.status).toBe(400)
})

test('POST rifiuta content mancante', async () => {
  const res = await POST(makeRequest('POST', { author: 'Mario' }))
  expect(res.status).toBe(400)
})

test('GET con since filtra messaggi precedenti', async () => {
  // Use explicit timestamps to avoid flakiness with SQLite unixepoch 1-second resolution
  const oldTs = Math.floor(Date.now() / 1000) - 10
  const newTs = Math.floor(Date.now() / 1000)
  db.prepare('INSERT INTO messages (author, content, created_at) VALUES (?, ?, ?)').run('Mario', 'Primo', oldTs)
  db.prepare('INSERT INTO messages (author, content, created_at) VALUES (?, ?, ?)').run('Nicol', 'Secondo', newTs)

  const filtered = await GET(makeRequest('GET', undefined, { since: String(oldTs) }))
  const data = await filtered.json()
  expect(data).toHaveLength(1)
  expect(data[0].content).toBe('Secondo')
})

test('GET con since non valido restituisce 400', async () => {
  const res = await GET(makeRequest('GET', undefined, { since: 'notanumber' }))
  expect(res.status).toBe(400)
})

test('POST rifiuta author più lungo di 50 caratteri', async () => {
  const res = await POST(makeRequest('POST', { author: 'a'.repeat(51), content: 'Testo valido' }))
  expect(res.status).toBe(400)
})

test('POST rifiuta content più lungo di 1000 caratteri', async () => {
  const res = await POST(makeRequest('POST', { author: 'Mario', content: 'x'.repeat(1001) }))
  expect(res.status).toBe(400)
})
