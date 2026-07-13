// src/__tests__/lib/users.test.ts
import { sqlite } from '@/db'
import { addAllowedEmail, updateAllowedEmailRole, upsertUser, getUserByEmail } from '@/lib/users'

beforeEach(() => {
  sqlite.exec('DELETE FROM users')
  sqlite.exec('DELETE FROM allowed_emails')
})

describe('fusione account: stessa email, provider diversi', () => {
  test('login via Credentials (whitelist) poi via Google con la stessa email risolve allo stesso utente', () => {
    addAllowedEmail('mario@example.com', 'member')

    // 1) Login "Credentials": solo email, nessun nome/immagine da un provider OAuth.
    const afterCredentials = upsertUser({ email: 'mario@example.com', name: 'mario' })
    expect(afterCredentials).toBeDefined()
    const userId = afterCredentials!.id

    // 2) Login "Google" successivo, stessa email, con nome/immagine reali dal profilo Google.
    const afterGoogle = upsertUser({ email: 'mario@example.com', name: 'Mario Rossi', image: 'https://lh3.googleusercontent.com/a/x' })

    expect(afterGoogle!.id).toBe(userId) // stessa riga, nessun account duplicato
    expect(afterGoogle!.name).toBe('Mario Rossi') // il nome più recente vince
    expect(afterGoogle!.image).toBe('https://lh3.googleusercontent.com/a/x')

    // Un'unica riga in users per questa email.
    const count = sqlite.prepare('SELECT COUNT(*) c FROM users WHERE email = ?').get('mario@example.com') as { c: number }
    expect(count.c).toBe(1)
  })

  test('un login successivo senza nome/immagine (es. re-login Credentials) non cancella i dati già presenti', () => {
    addAllowedEmail('mario@example.com', 'member')
    upsertUser({ email: 'mario@example.com', name: 'Mario Rossi', image: 'https://example.com/avatar.png' })

    // Re-login via Credentials: il form manda solo l'email, name/image non arrivano (undefined/null).
    const after = upsertUser({ email: 'mario@example.com' })

    expect(after!.name).toBe('Mario Rossi') // preservato via COALESCE
    expect(after!.image).toBe('https://example.com/avatar.png')
  })

  test("l'email viene normalizzata (case/spazi) prima del confronto — stesso utente in ogni caso", () => {
    addAllowedEmail('mario@example.com', 'member')
    const first = upsertUser({ email: '  Mario@Example.com  ' })
    const second = upsertUser({ email: 'MARIO@EXAMPLE.COM' })

    expect(second!.id).toBe(first!.id)
    expect(second!.email).toBe('mario@example.com')
  })

  test('il ruolo resta sincronizzato con la allowlist a ogni login, indipendentemente dal provider', () => {
    addAllowedEmail('admin@example.com', 'member')
    const before = upsertUser({ email: 'admin@example.com' })
    expect(before!.role).toBe('member')

    updateAllowedEmailRole('admin@example.com', 'admin')
    const after = upsertUser({ email: 'admin@example.com' }) // prossimo login, qualunque provider
    expect(after!.role).toBe('admin')
  })

  test('un\'email non in allowlist non crea né aggiorna alcun utente, con nessun provider', () => {
    const result = upsertUser({ email: 'sconosciuto@example.com' })
    expect(result).toBeUndefined()
    expect(getUserByEmail('sconosciuto@example.com')).toBeUndefined()
  })
})
