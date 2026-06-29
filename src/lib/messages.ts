// src/lib/messages.ts — Legacy spec-discussion chat (raw SQLite, not Drizzle schema).
import { sqlite } from '@/db'

export interface Message {
  id: number
  author: string
  content: string
  created_at: number
}

export function getMessages(since?: number): Message[] {
  if (since !== undefined) {
    return sqlite
      .prepare('SELECT * FROM messages WHERE created_at > ? ORDER BY created_at ASC')
      .all(since) as Message[]
  }
  return sqlite.prepare('SELECT * FROM messages ORDER BY created_at ASC').all() as Message[]
}

export function insertMessage(author: string, content: string): Message {
  return sqlite
    .prepare('INSERT INTO messages (author, content) VALUES (?, ?) RETURNING *')
    .get(author, content) as Message
}
