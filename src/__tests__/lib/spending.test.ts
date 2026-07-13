// src/__tests__/lib/spending.test.ts
import { sqlite } from '@/db'
import { insertBatch } from '@/lib/transactions'
import {
  buildFlowContext,
  fetchTrueExpenses,
  fetchTrueIncomes,
  median,
  mad,
  robustZ,
  percentile,
  medianGapDays,
  normalizeDescKey,
} from '@/lib/spending'

let ownerId: number
let accountA: number
let accountB: number

let soloOwnerId: number
let soloAccount: number

function makeUser(email: string): number {
  sqlite.exec(`
    INSERT OR IGNORE INTO allowed_emails (email, role) VALUES ('${email}','member');
    INSERT OR IGNORE INTO users (email, role) VALUES ('${email}','member');
  `)
  const user = sqlite.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number }
  return user.id
}

function makeAccount(owner: number, name: string): number {
  sqlite.prepare('INSERT INTO institutions (owner_id, name, kind) VALUES (?, ?, ?)').run(owner, `${name} Bank`, 'bank')
  const inst = sqlite.prepare('SELECT id FROM institutions WHERE owner_id = ? ORDER BY id DESC LIMIT 1').get(owner) as { id: number }
  sqlite.prepare('INSERT INTO bank_accounts (institution_id, owner_id, name, currency) VALUES (?,?,?,?)').run(inst.id, owner, name, 'EUR')
  const acc = sqlite.prepare('SELECT id FROM bank_accounts WHERE owner_id = ? ORDER BY id DESC LIMIT 1').get(owner) as { id: number }
  return acc.id
}

function cleanup(owner: number) {
  sqlite.exec(`DELETE FROM transactions    WHERE owner_id = ${owner}`)
  sqlite.exec(`DELETE FROM import_batches  WHERE owner_id = ${owner}`)
  sqlite.exec(`DELETE FROM bank_accounts   WHERE owner_id = ${owner}`)
  sqlite.exec(`DELETE FROM institutions    WHERE owner_id = ${owner}`)
  sqlite.exec(`DELETE FROM users           WHERE id = ${owner}`)
}

beforeAll(() => {
  ownerId  = makeUser('spending_test@example.com')
  accountA = makeAccount(ownerId, 'Conto A')
  accountB = makeAccount(ownerId, 'Conto B')

  soloOwnerId = makeUser('spending_solo_test@example.com')
  soloAccount = makeAccount(soloOwnerId, 'Conto Solo')

  const catSuper = sqlite.prepare("SELECT id FROM categories WHERE name='Supermercato'").get() as { id: number }
  const catTransfer = sqlite.prepare("SELECT id FROM categories WHERE kind='transfer' LIMIT 1").get() as { id: number }

  insertBatch({
    ownerId, bankAccountId: accountA,
    source: 'test', filename: 'spending_test.csv',
    rows: [
      // Coppia di trasferimento interno NON categorizzata: A → B, stesso giorno
      { owner_id: ownerId, bank_account_id: accountA, booked_date: '2026-06-01', amount_minor: -50000, currency: 'EUR', description_raw: 'Bonifico verso conto B', dedup_hash: 's1', category_id: null },
      { owner_id: ownerId, bank_account_id: accountB, booked_date: '2026-06-01', amount_minor:  50000, currency: 'EUR', description_raw: 'Bonifico da conto A',    dedup_hash: 's2', category_id: null },
      // Coppia al limite della finestra: 3 giorni di distanza → match
      { owner_id: ownerId, bank_account_id: accountA, booked_date: '2026-06-10', amount_minor: -30000, currency: 'EUR', description_raw: 'Giroconto out', dedup_hash: 's3', category_id: null },
      { owner_id: ownerId, bank_account_id: accountB, booked_date: '2026-06-13', amount_minor:  30000, currency: 'EUR', description_raw: 'Giroconto in',  dedup_hash: 's4', category_id: null },
      // Fuori finestra: 4 giorni → NO match
      { owner_id: ownerId, bank_account_id: accountA, booked_date: '2026-06-20', amount_minor: -20000, currency: 'EUR', description_raw: 'Uscita orfana',  dedup_hash: 's5', category_id: null },
      { owner_id: ownerId, bank_account_id: accountB, booked_date: '2026-06-24', amount_minor:  20000, currency: 'EUR', description_raw: 'Entrata orfana', dedup_hash: 's6', category_id: null },
      // Rimborso: positivo sullo STESSO conto → NO match
      { owner_id: ownerId, bank_account_id: accountA, booked_date: '2026-06-25', amount_minor: -15000, currency: 'EUR', description_raw: 'Acquisto reso',   dedup_hash: 's7', category_id: null },
      { owner_id: ownerId, bank_account_id: accountA, booked_date: '2026-06-26', amount_minor:  15000, currency: 'EUR', description_raw: 'Rimborso reso',   dedup_hash: 's8', category_id: null },
      // Gamba categorizzata come spesa → mai riclassificata, NO match
      { owner_id: ownerId, bank_account_id: accountA, booked_date: '2026-06-27', amount_minor: -12000, currency: 'EUR', description_raw: 'Spesa categorizzata', dedup_hash: 's9',  category_id: catSuper.id },
      { owner_id: ownerId, bank_account_id: accountB, booked_date: '2026-06-27', amount_minor:  12000, currency: 'EUR', description_raw: 'Entrata sospetta',    dedup_hash: 's10', category_id: null },
      // Greedy 1:1 — due negativi uguali, un solo positivo → esattamente 1 coppia
      { owner_id: ownerId, bank_account_id: accountA, booked_date: '2026-07-01', amount_minor: -7000, currency: 'EUR', description_raw: 'Doppio neg 1', dedup_hash: 's11', category_id: null },
      { owner_id: ownerId, bank_account_id: accountA, booked_date: '2026-07-02', amount_minor: -7000, currency: 'EUR', description_raw: 'Doppio neg 2', dedup_hash: 's12', category_id: null },
      { owner_id: ownerId, bank_account_id: accountB, booked_date: '2026-07-02', amount_minor:  7000, currency: 'EUR', description_raw: 'Singolo pos',  dedup_hash: 's13', category_id: null },
      // Trasferimento con categoria esplicita kind='transfer' → escluso dal filtro kind
      { owner_id: ownerId, bank_account_id: accountA, booked_date: '2026-07-03', amount_minor: -9000, currency: 'EUR', description_raw: 'Transfer esplicito', dedup_hash: 's14', category_id: catTransfer.id },
      // Spesa e reddito normali per fetchTrue*
      { owner_id: ownerId, bank_account_id: accountA, booked_date: '2026-07-05', amount_minor: -2500,   currency: 'EUR', description_raw: 'Esselunga',  dedup_hash: 's15', category_id: catSuper.id },
      { owner_id: ownerId, bank_account_id: accountA, booked_date: '2026-07-06', amount_minor:  250000, currency: 'EUR', description_raw: 'Stipendio',  dedup_hash: 's16', category_id: null },
    ],
  })

  // Utente mono-conto: coppia perfetta ma su un solo conto → nessuna detection
  insertBatch({
    ownerId: soloOwnerId, bankAccountId: soloAccount,
    source: 'test', filename: 'spending_solo_test.csv',
    rows: [
      { owner_id: soloOwnerId, bank_account_id: soloAccount, booked_date: '2026-06-01', amount_minor: -10000, currency: 'EUR', description_raw: 'Out', dedup_hash: 'ss1', category_id: null },
      { owner_id: soloOwnerId, bank_account_id: soloAccount, booked_date: '2026-06-01', amount_minor:  10000, currency: 'EUR', description_raw: 'In',  dedup_hash: 'ss2', category_id: null },
    ],
  })
})

afterAll(() => {
  cleanup(ownerId)
  cleanup(soloOwnerId)
})

describe('buildFlowContext — pair matcher', () => {
  test('rileva le coppie attese e solo quelle', () => {
    const ctx = buildFlowContext(ownerId)
    const excluded = JSON.parse(ctx.excludedIdsJson) as number[]

    const idByHash = (hash: string): number => {
      const row = sqlite.prepare(
        'SELECT id FROM transactions WHERE owner_id = ? AND dedup_hash = ?',
      ).get(ownerId, hash) as { id: number }
      return row.id
    }

    // Coppie attese: s1+s2, s3+s4 (3 giorni), e una sola tra {s11,s12}+s13
    expect(excluded).toContain(idByHash('s1'))
    expect(excluded).toContain(idByHash('s2'))
    expect(excluded).toContain(idByHash('s3'))
    expect(excluded).toContain(idByHash('s4'))
    expect(excluded).toContain(idByHash('s13'))

    // 4 giorni di distanza → esclusi
    expect(excluded).not.toContain(idByHash('s5'))
    expect(excluded).not.toContain(idByHash('s6'))
    // Rimborso stesso conto → esclusi
    expect(excluded).not.toContain(idByHash('s7'))
    expect(excluded).not.toContain(idByHash('s8'))
    // Gamba categorizzata → mai in coppia
    expect(excluded).not.toContain(idByHash('s9'))
    expect(excluded).not.toContain(idByHash('s10'))

    // Greedy 1:1: dei due negativi da 70€ solo uno è accoppiato (il più vicino: s12)
    const negPaired = [idByHash('s11'), idByHash('s12')].filter((id) => excluded.includes(id))
    expect(negPaired).toHaveLength(1)
    expect(negPaired[0]).toBe(idByHash('s12'))

    expect(ctx.pairCount).toBe(3)
    expect(ctx.hasMultipleCurrencies).toBe(false)
  })

  test('utente mono-conto → nessuna coppia', () => {
    const ctx = buildFlowContext(soloOwnerId)
    expect(ctx.excludedIdsJson).toBe('[]')
    expect(ctx.pairCount).toBe(0)
  })
})

describe('fetchTrueExpenses / fetchTrueIncomes', () => {
  test('esclude trasferimenti espliciti e coppie rilevate', () => {
    const ctx = buildFlowContext(ownerId)
    const expenses = fetchTrueExpenses(ctx, 24)
    const descs = expenses.map((t) => t.description_raw)

    // Escluse: coppie (s1, s3, s12) e transfer esplicito (s14)
    expect(descs).not.toContain('Bonifico verso conto B')
    expect(descs).not.toContain('Giroconto out')
    expect(descs).not.toContain('Doppio neg 2')
    expect(descs).not.toContain('Transfer esplicito')
    // Incluse: spese vere, orfani, rimborsi, gamba categorizzata, neg non accoppiato
    expect(descs).toContain('Esselunga')
    expect(descs).toContain('Uscita orfana')
    expect(descs).toContain('Acquisto reso')
    expect(descs).toContain('Spesa categorizzata')
    expect(descs).toContain('Doppio neg 1')

    const incomes = fetchTrueIncomes(ctx, 24)
    const incomeDescs = incomes.map((t) => t.description_raw)
    expect(incomeDescs).toContain('Stipendio')
    expect(incomeDescs).toContain('Rimborso reso')
    expect(incomeDescs).not.toContain('Bonifico da conto A')
    expect(incomeDescs).not.toContain('Giroconto in')
    expect(incomeDescs).not.toContain('Singolo pos')
  })
})

describe('utilities statistiche', () => {
  test('median', () => {
    expect(median([])).toBe(0)
    expect(median([5])).toBe(5)
    expect(median([1, 2, 3])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  test('mad', () => {
    // mediana = 3, scarti = [2,1,0,1,2] → mad = 1
    expect(mad([1, 2, 3, 4, 5])).toBe(1)
    expect(mad([7, 7, 7])).toBe(0)
  })

  test('robustZ', () => {
    expect(robustZ(3, 3, 1)).toBe(0)
    expect(robustZ(13, 3, 1)).toBeCloseTo(6.745)
    expect(robustZ(5, 3, 0)).toBe(Infinity)
    expect(robustZ(3, 3, 0)).toBe(0)
  })

  test('percentile', () => {
    expect(percentile([1, 2, 3, 4], 0)).toBe(1)
    expect(percentile([1, 2, 3, 4], 1)).toBe(4)
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5)
  })

  test('medianGapDays', () => {
    expect(medianGapDays(['2026-01-01'])).toBeNull()
    expect(medianGapDays(['2026-01-01', '2026-02-01', '2026-03-01'])).toBe(29.5)
    // ordine sparso → viene ordinato
    expect(medianGapDays(['2026-01-08', '2026-01-01'])).toBe(7)
  })

  test('normalizeDescKey', () => {
    expect(normalizeDescKey('NETFLIX.COM 123456')).toBe('netflix com')
    expect(normalizeDescKey('PayPal *Spotify')).toBe('paypal spotify')
    expect(normalizeDescKey('AB 12')).toBeNull()
  })
})
