// src/lib/messages.ts
import { db } from './db'

export interface Message {
  id: number
  author: string
  content: string
  created_at: number
}

export function getMessages(since?: number): Message[] {
  if (since !== undefined) {
    return db
      .prepare('SELECT * FROM messages WHERE created_at > ? ORDER BY created_at ASC')
      .all(since) as Message[]
  }
  return db.prepare('SELECT * FROM messages ORDER BY created_at ASC').all() as Message[]
}

export function insertMessage(author: string, content: string): Message {
  return db
    .prepare('INSERT INTO messages (author, content) VALUES (?, ?) RETURNING *')
    .get(author, content) as Message
}
