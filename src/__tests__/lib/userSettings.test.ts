// userSettings.ts tests — uses real DB and real crypto (AUTH_SECRET set in jest.env.ts).
import { sqlite } from '@/db'
import {
  setOpenAiKey, getOpenAiKey, clearOpenAiKey, hasOpenAiKey, getOpenAiKeySetAt,
} from '@/lib/userSettings'

let userId: number

beforeAll(() => {
  sqlite.prepare(`INSERT INTO users (email, name, role) VALUES ('settings-test@example.com', 'Test', 'member')`).run()
  const u = sqlite.prepare(`SELECT id FROM users WHERE email = 'settings-test@example.com'`).get() as { id: number }
  userId = u.id
})

afterAll(() => {
  sqlite.prepare(`DELETE FROM user_settings WHERE user_id = ?`).run(userId)
  sqlite.prepare(`DELETE FROM users WHERE id = ?`).run(userId)
})

afterEach(() => {
  sqlite.prepare(`DELETE FROM user_settings WHERE user_id = ?`).run(userId)
})

describe('setOpenAiKey / getOpenAiKey', () => {
  test('set then get returns the original plaintext key', () => {
    setOpenAiKey(userId, 'sk-test-original-1234')
    expect(getOpenAiKey(userId)).toBe('sk-test-original-1234')
  })

  test('value stored in DB is encrypted (not the plain key)', () => {
    setOpenAiKey(userId, 'sk-plaintext-key')
    const row = sqlite.prepare(`SELECT openai_api_key_enc FROM user_settings WHERE user_id = ?`).get(userId) as { openai_api_key_enc: string }
    expect(row.openai_api_key_enc).not.toBe('sk-plaintext-key')
    expect(row.openai_api_key_enc).not.toContain('sk-plaintext-key')
  })

  test('calling set twice updates the key (idempotent upsert)', () => {
    setOpenAiKey(userId, 'sk-first')
    setOpenAiKey(userId, 'sk-second')
    expect(getOpenAiKey(userId)).toBe('sk-second')
    const count = sqlite.prepare(`SELECT COUNT(*) as n FROM user_settings WHERE user_id = ?`).get(userId) as { n: number }
    expect(count.n).toBe(1)
  })
})

describe('hasOpenAiKey', () => {
  test('false when no key is set', () => {
    expect(hasOpenAiKey(userId)).toBe(false)
  })

  test('true after key is set', () => {
    setOpenAiKey(userId, 'sk-exists')
    expect(hasOpenAiKey(userId)).toBe(true)
  })
})

describe('clearOpenAiKey', () => {
  test('key is null after clear', () => {
    setOpenAiKey(userId, 'sk-to-clear')
    clearOpenAiKey(userId)
    expect(getOpenAiKey(userId)).toBeNull()
    expect(hasOpenAiKey(userId)).toBe(false)
  })

  test('set_at is also cleared', () => {
    setOpenAiKey(userId, 'sk-key')
    clearOpenAiKey(userId)
    expect(getOpenAiKeySetAt(userId)).toBeNull()
  })
})

describe('getOpenAiKey — missing user', () => {
  test('returns null when user has no settings row', () => {
    expect(getOpenAiKey(99999)).toBeNull()
  })
})
