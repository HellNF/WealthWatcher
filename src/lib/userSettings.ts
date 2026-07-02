// Per-user settings repository. Stores encrypted OpenAI API key in user_settings.
import { sqlite } from '@/db'
import { encryptSecret, decryptSecret } from '@/lib/crypto'
import type { UserSettings } from '@/db/schema'

function row(userId: number): UserSettings | undefined {
  return sqlite
    .prepare(`SELECT * FROM user_settings WHERE user_id = ?`)
    .get(userId) as UserSettings | undefined
}

export function hasOpenAiKey(userId: number): boolean {
  const r = sqlite
    .prepare(`SELECT openai_api_key_enc FROM user_settings WHERE user_id = ?`)
    .get(userId) as { openai_api_key_enc: string | null } | undefined
  return r?.openai_api_key_enc != null
}

export function getOpenAiKeySetAt(userId: number): number | null {
  const r = row(userId)
  return r?.openai_key_set_at ?? null
}

export function setOpenAiKey(userId: number, plainKey: string): void {
  const enc = encryptSecret(plainKey)
  const now = Math.floor(Date.now() / 1000)
  sqlite.prepare(`
    INSERT INTO user_settings (user_id, openai_api_key_enc, openai_key_set_at)
    VALUES (?, ?, ?)
    ON CONFLICT (user_id) DO UPDATE SET
      openai_api_key_enc = excluded.openai_api_key_enc,
      openai_key_set_at  = excluded.openai_key_set_at
  `).run(userId, enc, now)
}

export function getOpenAiKey(userId: number): string | null {
  const r = row(userId)
  if (!r?.openai_api_key_enc) return null
  try {
    return decryptSecret(r.openai_api_key_enc)
  } catch {
    return null
  }
}

export function clearOpenAiKey(userId: number): void {
  sqlite.prepare(`
    UPDATE user_settings
    SET openai_api_key_enc = NULL, openai_key_set_at = NULL
    WHERE user_id = ?
  `).run(userId)
}
