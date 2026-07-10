// src/__tests__/lib/banking-cascade.test.ts — Verifica che le nuove relazioni
// introdotte da eb_connections (institution → eb_connections → bank_accounts)
// non rompano i cascade delete esistenti su institutions/bank_accounts, e che
// l'eliminazione dell'istituzione non lasci righe orfane o violi FK.
import { sqlite } from '@/db'
import { createInstitution, deleteInstitution } from '@/lib/institutions'
import { deleteAccount } from '@/lib/accounts'
import { createPendingConnection, activateConnection, linkOrCreateAccount } from '@/lib/banking/connections'

let userId: number

beforeAll(() => {
  sqlite.prepare(`INSERT INTO users (email, name, role) VALUES ('eb-cascade-test@example.com', 'Test', 'member')`).run()
  const u = sqlite.prepare(`SELECT id FROM users WHERE email = 'eb-cascade-test@example.com'`).get() as { id: number }
  userId = u.id
})

afterAll(() => {
  sqlite.prepare(`DELETE FROM users WHERE id = ?`).run(userId)
})

function countConnections(institutionId: number): number {
  return (sqlite.prepare(`SELECT COUNT(*) AS n FROM eb_connections WHERE institution_id = ?`).get(institutionId) as { n: number }).n
}
function countAccounts(institutionId: number): number {
  return (sqlite.prepare(`SELECT COUNT(*) AS n FROM bank_accounts WHERE institution_id = ?`).get(institutionId) as { n: number }).n
}

describe('cascade: eliminare un\'istituzione elimina anche connessioni e conti EB collegati', () => {
  test('nessuna violazione FK, nessuna riga orfana', () => {
    const institution = createInstitution(userId, 'Test Bank EB', 'bank')
    const connection  = createPendingConnection(userId, institution.id, 'Test ASPSP', 'IT', new Date(Date.now() + 86_400_000))
    activateConnection(connection.id, 'fake-session-id')
    const account = linkOrCreateAccount(userId, institution.id, connection.id, 'eb-uid-1', 'Conto EB', 'EUR')

    expect(countConnections(institution.id)).toBe(1)
    expect(countAccounts(institution.id)).toBe(1)
    expect(account.eb_connection_id).toBe(connection.id)

    // Non deve lanciare (violazione FK) e deve cascare su entrambe le tabelle.
    expect(() => deleteInstitution(userId, institution.id)).not.toThrow()

    expect(countConnections(institution.id)).toBe(0)
    expect(countAccounts(institution.id)).toBe(0)
    const remainingAccount = sqlite.prepare(`SELECT 1 FROM bank_accounts WHERE id = ?`).get(account.id)
    expect(remainingAccount).toBeUndefined()
  })
})

describe('cascade: eliminare un conto EB non tocca la connessione (eb_connections resta, audit)', () => {
  test('eb_connection_id non blocca la delete del solo conto', () => {
    const institution = createInstitution(userId, 'Test Bank EB 2', 'bank')
    const connection  = createPendingConnection(userId, institution.id, 'Test ASPSP 2', 'IT', new Date(Date.now() + 86_400_000))
    activateConnection(connection.id, 'fake-session-id-2')
    const account = linkOrCreateAccount(userId, institution.id, connection.id, 'eb-uid-2', 'Conto EB 2', 'EUR')

    expect(() => deleteAccount(userId, account.id)).not.toThrow()

    const connectionRow = sqlite.prepare(`SELECT status FROM eb_connections WHERE id = ?`).get(connection.id) as { status: string } | undefined
    expect(connectionRow?.status).toBe('active') // la connessione resta, solo il conto è stato rimosso

    deleteInstitution(userId, institution.id) // cleanup
  })
})

describe('linkOrCreateAccount è idempotente su (eb_connection_id, eb_account_uid)', () => {
  test('una seconda chiamata con lo stesso uid ritorna il conto esistente, non ne crea un altro', () => {
    const institution = createInstitution(userId, 'Test Bank EB 3', 'bank')
    const connection  = createPendingConnection(userId, institution.id, 'Test ASPSP 3', 'IT', new Date(Date.now() + 86_400_000))
    activateConnection(connection.id, 'fake-session-id-3')

    const first  = linkOrCreateAccount(userId, institution.id, connection.id, 'eb-uid-3', 'Conto EB 3', 'EUR')
    const second = linkOrCreateAccount(userId, institution.id, connection.id, 'eb-uid-3', 'Conto EB 3 rinominato', 'EUR')

    expect(second.id).toBe(first.id)
    expect(countAccounts(institution.id)).toBe(1)

    deleteInstitution(userId, institution.id) // cleanup
  })
})
