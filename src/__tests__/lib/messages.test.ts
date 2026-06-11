// src/__tests__/lib/messages.test.ts
import { db } from '@/lib/db'
import { getMessages, insertMessage } from '@/lib/messages'

beforeEach(() => {
  db.exec('DELETE FROM messages')
})

test('getMessages restituisce array vuoto se non ci sono messaggi', () => {
  const result = getMessages()
  expect(result).toEqual([])
})

test('insertMessage salva e restituisce il messaggio', () => {
  const msg = insertMessage('Mario', 'Proposta di test')
  expect(msg.id).toBeDefined()
  expect(msg.author).toBe('Mario')
  expect(msg.content).toBe('Proposta di test')
  expect(msg.created_at).toBeGreaterThan(0)
})

test('getMessages restituisce tutti i messaggi in ordine cronologico', () => {
  insertMessage('Mario', 'Primo')
  insertMessage('Nicol', 'Secondo')
  const messages = getMessages()
  expect(messages).toHaveLength(2)
  expect(messages[0].content).toBe('Primo')
  expect(messages[1].content).toBe('Secondo')
})

test('getMessages con since filtra messaggi più vecchi', () => {
  // Use explicit timestamps to avoid flakiness when both inserts happen within the same second
  const oldTs = Math.floor(Date.now() / 1000) - 10
  const newTs = Math.floor(Date.now() / 1000)
  db.prepare('INSERT INTO messages (author, content, created_at) VALUES (?, ?, ?)').run('Mario', 'Vecchio', oldTs)
  db.prepare('INSERT INTO messages (author, content, created_at) VALUES (?, ?, ?)').run('Nicol', 'Nuovo', newTs)
  const messages = getMessages(oldTs)
  expect(messages).toHaveLength(1)
  expect(messages[0].content).toBe('Nuovo')
})
