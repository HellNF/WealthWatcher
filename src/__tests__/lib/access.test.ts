// src/__tests__/lib/access.test.ts
import { sqlite } from '@/db'
import { isEmailAllowed, getAllowedRole, upsertUser } from '@/lib/users'
import {
  createInstitution,
  listInstitutions,
  getInstitutionForUser,
} from '@/lib/institutions'

function allow(email: string, role: 'admin' | 'member' = 'member') {
  sqlite.prepare('INSERT INTO allowed_emails (email, role) VALUES (?, ?)').run(email, role)
}

beforeEach(() => {
  sqlite.exec(
    'DELETE FROM shares; DELETE FROM bank_accounts; DELETE FROM institutions; DELETE FROM users; DELETE FROM allowed_emails;',
  )
})

describe('allowlist', () => {
  test('email sconosciuta non è autorizzata', () => {
    expect(isEmailAllowed('stranger@example.com')).toBe(false)
    expect(getAllowedRole('stranger@example.com')).toBeNull()
  })

  test('email in allowlist è autorizzata, case-insensitive', () => {
    allow('alice@example.com', 'admin')
    expect(isEmailAllowed('Alice@Example.com')).toBe(true)
    expect(getAllowedRole('ALICE@EXAMPLE.COM')).toBe('admin')
  })

  test('upsertUser rifiuta chi non è in allowlist', () => {
    expect(upsertUser({ email: 'stranger@example.com' })).toBeUndefined()
    expect(sqlite.prepare('SELECT COUNT(*) c FROM users').get()).toEqual({ c: 0 })
  })

  test('upsertUser rispecchia il ruolo della allowlist e aggiorna al re-login', () => {
    allow('bob@example.com', 'member')
    const created = upsertUser({ email: 'BOB@example.com', name: 'Bob' })
    expect(created?.role).toBe('member')
    expect(created?.email).toBe('bob@example.com')

    // promosso ad admin nella allowlist -> ruolo aggiornato al prossimo login
    sqlite.prepare("UPDATE allowed_emails SET role='admin' WHERE email='bob@example.com'").run()
    const refreshed = upsertUser({ email: 'bob@example.com' })
    expect(refreshed?.id).toBe(created?.id)
    expect(refreshed?.role).toBe('admin')
  })
})

describe('ownership isolation', () => {
  test("un utente non vede le istituzioni di un altro", () => {
    allow('alice@example.com')
    allow('eve@example.com')
    const alice = upsertUser({ email: 'alice@example.com' })!
    const eve = upsertUser({ email: 'eve@example.com' })!

    const inst = createInstitution(alice.id, 'Intesa San Paolo', 'both')

    expect(listInstitutions(alice.id).map((i) => i.id)).toContain(inst.id)
    expect(listInstitutions(eve.id)).toHaveLength(0)
    expect(getInstitutionForUser(alice.id, inst.id)?.name).toBe('Intesa San Paolo')
    expect(getInstitutionForUser(eve.id, inst.id)).toBeUndefined()
  })

  test('una condivisione rende visibile l’istituzione al destinatario', () => {
    allow('alice@example.com')
    allow('eve@example.com')
    const alice = upsertUser({ email: 'alice@example.com' })!
    const eve = upsertUser({ email: 'eve@example.com' })!
    const inst = createInstitution(alice.id, 'Revolut', 'bank')

    sqlite.prepare(
      "INSERT INTO shares (entity_type, entity_id, user_id, role) VALUES ('institution', ?, ?, 'viewer')",
    ).run(inst.id, eve.id)

    expect(listInstitutions(eve.id).map((i) => i.id)).toContain(inst.id)
    expect(getInstitutionForUser(eve.id, inst.id)?.name).toBe('Revolut')
  })
})
