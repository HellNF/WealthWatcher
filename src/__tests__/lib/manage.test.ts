// src/__tests__/lib/manage.test.ts
// CRUD di gestione: update/delete di istituzioni, conti, portafogli — ownership + cascata.
import { sqlite } from '@/db'
import {
  createInstitution, getInstitutionForUser, updateInstitution, deleteInstitution,
} from '@/lib/institutions'
import {
  createAccount, getAccountForUser, updateAccount, deleteAccount,
} from '@/lib/accounts'
import {
  createPortfolio, getPortfolioForUser, updatePortfolio, deletePortfolio,
} from '@/lib/portfolios'

let userId: number
const OTHER = 999999 // utente inesistente / diverso

beforeAll(() => {
  sqlite.prepare(`INSERT INTO users (email, name, role) VALUES ('mgmt@example.com', 'Mgmt', 'member')`).run()
  userId = (sqlite.prepare(`SELECT id FROM users WHERE email = 'mgmt@example.com'`).get() as { id: number }).id
})

afterAll(() => {
  sqlite.prepare(`DELETE FROM institutions WHERE owner_id = ?`).run(userId)
  sqlite.prepare(`DELETE FROM users WHERE id = ?`).run(userId)
})

describe('updateInstitution', () => {
  test('modifica nome e tipo (owner)', () => {
    const inst = createInstitution(userId, 'Banca X', 'bank')
    expect(updateInstitution(userId, inst.id, { name: 'Banca Y', kind: 'both' })).toBe(true)
    const reloaded = getInstitutionForUser(userId, inst.id)!
    expect(reloaded.name).toBe('Banca Y')
    expect(reloaded.kind).toBe('both')
  })

  test('un altro utente non può modificare', () => {
    const inst = createInstitution(userId, 'Privata', 'bank')
    expect(updateInstitution(OTHER, inst.id, { name: 'Hacked' })).toBe(false)
    expect(getInstitutionForUser(userId, inst.id)!.name).toBe('Privata')
  })
})

describe('deleteAccount', () => {
  test('elimina il conto e a cascata i suoi movimenti', () => {
    const inst = createInstitution(userId, 'Inst conti', 'bank')
    const acc = createAccount(userId, inst.id, 'Conto', 'EUR')
    sqlite.prepare(
      `INSERT INTO transactions (owner_id, bank_account_id, booked_date, description_raw, dedup_hash, amount_minor, currency)
       VALUES (?, ?, '2024-01-01', 'x', 'mgmt-h1', 100, 'EUR')`,
    ).run(userId, acc.id)

    expect(deleteAccount(userId, acc.id)).toBe(true)
    expect(getAccountForUser(userId, acc.id)).toBeUndefined()
    const leftover = sqlite.prepare(`SELECT COUNT(*) AS n FROM transactions WHERE bank_account_id = ?`).get(acc.id) as { n: number }
    expect(leftover.n).toBe(0)
  })

  test('rename e ownership', () => {
    const inst = createInstitution(userId, 'Inst2', 'bank')
    const acc = createAccount(userId, inst.id, 'Vecchio', 'EUR')
    expect(updateAccount(userId, acc.id, { name: 'Nuovo' })).toBe(true)
    expect(getAccountForUser(userId, acc.id)!.name).toBe('Nuovo')
    expect(deleteAccount(OTHER, acc.id)).toBe(false)
    expect(getAccountForUser(userId, acc.id)).toBeDefined()
  })
})

describe('deletePortfolio', () => {
  test('elimina il portafoglio (owner) e blocca altri utenti', () => {
    const inst = createInstitution(userId, 'Inst pf', 'broker')
    const pf = createPortfolio(userId, inst.id, 'PF', 'EUR')
    expect(updatePortfolio(userId, pf.id, { name: 'PF rinominato' })).toBe(true)
    expect(getPortfolioForUser(userId, pf.id)!.name).toBe('PF rinominato')
    expect(deletePortfolio(OTHER, pf.id)).toBe(false)
    expect(deletePortfolio(userId, pf.id)).toBe(true)
    expect(getPortfolioForUser(userId, pf.id)).toBeUndefined()
  })
})

describe('deleteInstitution — cascata su conti e portafogli', () => {
  test('elimina istituzione e i figli', () => {
    const inst = createInstitution(userId, 'Da eliminare', 'both')
    const acc = createAccount(userId, inst.id, 'C', 'EUR')
    const pf = createPortfolio(userId, inst.id, 'P', 'EUR')

    expect(deleteInstitution(userId, inst.id)).toBe(true)
    expect(getInstitutionForUser(userId, inst.id)).toBeUndefined()
    expect(getAccountForUser(userId, acc.id)).toBeUndefined()
    expect(getPortfolioForUser(userId, pf.id)).toBeUndefined()
  })
})
