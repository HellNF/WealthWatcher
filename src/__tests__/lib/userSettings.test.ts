// userSettings.ts tests — uses real DB and real crypto (AUTH_SECRET set in jest.env.ts).
import { sqlite } from '@/db'
import {
  setOpenAiKey, getOpenAiKey, clearOpenAiKey, hasOpenAiKey, getOpenAiKeySetAt,
  setEnableBankingKey, getEnableBankingKey, clearEnableBankingKey,
  hasEnableBankingKey, getEnableBankingKeySetAt,
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

describe('setEnableBankingKey / getEnableBankingKey', () => {
  test('set then get returns app_id in chiaro e private_key decifrata', () => {
    setEnableBankingKey(userId, 'app-123', '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----')
    expect(getEnableBankingKey(userId)).toEqual({
      appId:      'app-123',
      privateKey: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----',
    })
  })

  test('la private key è cifrata nel DB (non il valore in chiaro)', () => {
    setEnableBankingKey(userId, 'app-123', '-----BEGIN PRIVATE KEY-----\nsecret-material\n-----END PRIVATE KEY-----')
    const row = sqlite.prepare(`SELECT eb_private_key_enc FROM user_settings WHERE user_id = ?`).get(userId) as { eb_private_key_enc: string }
    expect(row.eb_private_key_enc).not.toContain('secret-material')
  })

  test('chiamare set due volte aggiorna la riga esistente (upsert idempotente)', () => {
    setEnableBankingKey(userId, 'app-first', 'key-first')
    setEnableBankingKey(userId, 'app-second', 'key-second')
    expect(getEnableBankingKey(userId)).toEqual({ appId: 'app-second', privateKey: 'key-second' })
    const count = sqlite.prepare(`SELECT COUNT(*) as n FROM user_settings WHERE user_id = ?`).get(userId) as { n: number }
    expect(count.n).toBe(1)
  })

  test('non interferisce con la chiave OpenAI dello stesso utente', () => {
    setOpenAiKey(userId, 'sk-openai')
    setEnableBankingKey(userId, 'app-eb', 'key-eb')
    expect(getOpenAiKey(userId)).toBe('sk-openai')
    expect(getEnableBankingKey(userId)).toEqual({ appId: 'app-eb', privateKey: 'key-eb' })
  })
})

describe('hasEnableBankingKey', () => {
  test('false quando nessuna chiave è impostata', () => {
    expect(hasEnableBankingKey(userId)).toBe(false)
  })

  test('true dopo aver impostato la chiave', () => {
    setEnableBankingKey(userId, 'app-123', 'key-material')
    expect(hasEnableBankingKey(userId)).toBe(true)
  })
})

describe('clearEnableBankingKey', () => {
  test('la chiave è null dopo clear', () => {
    setEnableBankingKey(userId, 'app-123', 'key-material')
    clearEnableBankingKey(userId)
    expect(getEnableBankingKey(userId)).toBeNull()
    expect(hasEnableBankingKey(userId)).toBe(false)
  })

  test('anche set_at viene azzerato', () => {
    setEnableBankingKey(userId, 'app-123', 'key-material')
    clearEnableBankingKey(userId)
    expect(getEnableBankingKeySetAt(userId)).toBeNull()
  })
})

describe('getEnableBankingKey — utente senza riga settings', () => {
  test('ritorna null se l\'utente non ha una riga user_settings', () => {
    expect(getEnableBankingKey(99999)).toBeNull()
  })
})
