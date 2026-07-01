// src/__tests__/lib/accountBalance.test.ts
// Saldo del conto: somma movimenti vs saldo di riferimento (anchor) + movimenti successivi.
import { sqlite } from '@/db'
import {
  getAccountBalanceMinor,
  setAccountBalanceAnchor,
  clearAccountBalanceAnchor,
} from '@/lib/accounts'

let userId: number
let accountId: number

function addTxn(date: string, amountMinor: number, hash: string) {
  sqlite
    .prepare(
      `INSERT INTO transactions
         (owner_id, bank_account_id, booked_date, description_raw, dedup_hash, amount_minor, currency)
       VALUES (?, ?, ?, 'x', ?, ?, 'EUR')`,
    )
    .run(userId, accountId, date, hash, amountMinor)
}

beforeAll(() => {
  sqlite.prepare(`INSERT INTO users (email, name, role) VALUES ('baltest@example.com', 'Bal', 'member')`).run()
  userId = (sqlite.prepare(`SELECT id FROM users WHERE email = 'baltest@example.com'`).get() as { id: number }).id

  sqlite.prepare(`INSERT INTO institutions (owner_id, name, kind) VALUES (?, 'BalBank', 'bank')`).run(userId)
  const inst = sqlite.prepare(`SELECT id FROM institutions WHERE owner_id = ?`).get(userId) as { id: number }

  sqlite.prepare(`INSERT INTO bank_accounts (owner_id, institution_id, name, currency) VALUES (?, ?, 'Acc', 'EUR')`).run(userId, inst.id)
  accountId = (sqlite.prepare(`SELECT id FROM bank_accounts WHERE owner_id = ?`).get(userId) as { id: number }).id

  // Movimenti: prima, sulla, e dopo la futura data di anchor (2024-06-15)
  addTxn('2024-06-10', 10000, 'b-1')  // +100.00 (prima dell'anchor)
  addTxn('2024-06-15', -2000, 'b-2')  //  -20.00 (nel giorno dell'anchor)
  addTxn('2024-06-20',  5000, 'b-3')  //  +50.00 (dopo l'anchor)
  addTxn('2024-06-25', -1000, 'b-4')  //  -10.00 (dopo l'anchor)
})

afterAll(() => {
  sqlite.prepare(`DELETE FROM transactions WHERE owner_id = ?`).run(userId)
  sqlite.prepare(`DELETE FROM bank_accounts WHERE owner_id = ?`).run(userId)
  sqlite.prepare(`DELETE FROM institutions WHERE owner_id = ?`).run(userId)
  sqlite.prepare(`DELETE FROM users WHERE id = ?`).run(userId)
})

describe('getAccountBalanceMinor', () => {
  afterEach(() => {
    clearAccountBalanceAnchor(userId, accountId)
  })

  test('senza anchor: somma dell\'intero storico movimenti', () => {
    // 10000 - 2000 + 5000 - 1000 = 12000
    expect(getAccountBalanceMinor(accountId)).toBe(12000)
  })

  test('con anchor: saldo di riferimento + solo movimenti con data successiva', () => {
    // anchor 200.00 al 2024-06-15 → + (5000 - 1000) dei movimenti dopo il 15
    setAccountBalanceAnchor(userId, accountId, 20000, '2024-06-15')
    expect(getAccountBalanceMinor(accountId)).toBe(20000 + 4000) // 24000
  })

  test('il movimento nel giorno dell\'anchor è escluso (semantica > data)', () => {
    // anchor al 2024-06-20 → escluso il -1000? no: dopo il 20 c\'è solo il 25 (-1000)
    setAccountBalanceAnchor(userId, accountId, 0, '2024-06-20')
    expect(getAccountBalanceMinor(accountId)).toBe(-1000)
  })

  test('anchor dopo tutti i movimenti → saldo = solo il riferimento', () => {
    setAccountBalanceAnchor(userId, accountId, 33300, '2024-12-31')
    expect(getAccountBalanceMinor(accountId)).toBe(33300)
  })

  test('clear riporta alla somma dei movimenti', () => {
    setAccountBalanceAnchor(userId, accountId, 99999, '2024-06-15')
    clearAccountBalanceAnchor(userId, accountId)
    expect(getAccountBalanceMinor(accountId)).toBe(12000)
  })
})

describe('setAccountBalanceAnchor — ownership', () => {
  afterEach(() => clearAccountBalanceAnchor(userId, accountId))

  test('un utente diverso non può impostare il saldo', () => {
    const ok = setAccountBalanceAnchor(userId + 9999, accountId, 50000, '2024-06-15')
    expect(ok).toBe(false)
    expect(getAccountBalanceMinor(accountId)).toBe(12000) // invariato
  })
})
