// Patrimonio ricostruito: saldi all'indietro dal riferimento, conti senza
// riferimento in avanti da zero, investimenti FIFO × prezzo di chiusura,
// ripieghi su prezzi vecchi o mancanti, cambi solo da cache, beni dalla
// valutazione più vicina. Più la coerenza con il saldo attuale dell'app.
import { sqlite } from '@/db'
import { reconstructNetWorth, historyBeforeSnapshots, firstReconstructableDate } from '@/lib/netWorthHistory'
import { getAccountBalanceMinor } from '@/lib/accounts'

let userId: number, institutionId: number
const at = (date: string) => reconstructNetWorth(userId, date, date)[0]

beforeAll(() => {
  sqlite.exec(`
    INSERT OR IGNORE INTO allowed_emails (email, role) VALUES ('nwhist@example.com','member');
    INSERT OR IGNORE INTO users (email, role) VALUES ('nwhist@example.com','member');
  `)
  userId = (sqlite.prepare("SELECT id FROM users WHERE email='nwhist@example.com'").get() as { id: number }).id
  sqlite.prepare(`INSERT INTO institutions (owner_id, name, kind) VALUES (?, 'Banca', 'bank')`).run(userId)
  institutionId = (sqlite.prepare('SELECT id FROM institutions WHERE owner_id = ?').get(userId) as { id: number }).id
})

afterEach(() => {
  sqlite.prepare('DELETE FROM investment_txns WHERE owner_id = ?').run(userId)
  sqlite.prepare('DELETE FROM investment_portfolios WHERE owner_id = ?').run(userId)
  sqlite.prepare('DELETE FROM transactions WHERE owner_id = ?').run(userId)
  sqlite.prepare('DELETE FROM bank_accounts WHERE owner_id = ?').run(userId)
  sqlite.prepare('DELETE FROM asset_valuations WHERE asset_id IN (SELECT id FROM assets WHERE owner_id = ?)').run(userId)
  sqlite.prepare('DELETE FROM assets WHERE owner_id = ?').run(userId)
  sqlite.prepare("DELETE FROM fx_history WHERE quote = 'CHF'").run()
})

function account(currency = 'EUR', anchor?: { minor: number; date: string }): number {
  const info = sqlite.prepare(
    `INSERT INTO bank_accounts (institution_id, owner_id, name, currency, anchor_balance_minor, anchor_date)
     VALUES (?, ?, 'Conto', ?, ?, ?)`,
  ).run(institutionId, userId, currency, anchor?.minor ?? null, anchor?.date ?? null)
  return Number(info.lastInsertRowid)
}
function txn(accountId: number, date: string, amountMinor: number, currency = 'EUR') {
  sqlite.prepare(
    `INSERT INTO transactions (owner_id, bank_account_id, booked_date, amount_minor, currency, description_raw, dedup_hash)
     VALUES (?, ?, ?, ?, ?, 'x', ?)`,
  ).run(userId, accountId, date, amountMinor, currency, `nwh-${Math.random()}`)
}

test('saldo con riferimento: ricostruito all’indietro e coerente con il saldo attuale', () => {
  const id = account('EUR', { minor: 100_000, date: '2026-06-30' })
  txn(id, '2026-06-01', 50_000)   // stipendio
  txn(id, '2026-06-15', -20_000)  // spesa
  txn(id, '2026-07-10', -5_000)   // dopo il riferimento
  // 31/05: prima di entrambi i movimenti → 1000 − 500 + 200 = 700 €
  expect(at('2026-05-31').accountsEurMinor).toBe(70_000)
  expect(at('2026-06-01').accountsEurMinor).toBe(120_000)
  expect(at('2026-06-30').accountsEurMinor).toBe(100_000)
  expect(at('2026-07-10').accountsEurMinor).toBe(95_000)
  // Il saldo di apertura prima del primo movimento è una supposizione.
  expect(at('2026-05-31').complete).toBe(false)
  expect(at('2026-06-01').complete).toBe(true)
  const today = new Date().toISOString().slice(0, 10)
  expect(at(today).accountsEurMinor).toBe(getAccountBalanceMinor(id))
})

test('conto senza riferimento: somma dei movimenti; conto senza movimenti: costante', () => {
  const id = account()
  txn(id, '2026-03-01', 10_000)
  txn(id, '2026-03-05', -2_500)
  account('EUR', { minor: 40_000, date: '2026-09-01' }) // solo saldo, nessun movimento
  expect(at('2026-02-28')).toMatchObject({ accountsEurMinor: 40_000, complete: true })
  expect(at('2026-03-05')).toMatchObject({ accountsEurMinor: 47_500, complete: true })
})

test('valute: solo cambi già salvati e recenti, altrimenti punto incompleto', () => {
  const id = account('CHF')
  txn(id, '2026-03-01', 10_000, 'CHF')
  sqlite.prepare(`INSERT INTO fx_history (date, base, quote, rate) VALUES ('2026-03-02', 'EUR', 'CHF', '0.5')`).run()
  expect(at('2026-03-01').complete).toBe(false)              // nessun cambio fino a quella data
  expect(at('2026-03-03')).toMatchObject({ accountsEurMinor: 20_000, complete: true })
  expect(at('2026-03-20').complete).toBe(false)              // cambio troppo vecchio
})

test('investimenti: quantità alla data × prezzo di chiusura, con ripieghi senza crolli a zero', () => {
  sqlite.prepare(`INSERT INTO investment_portfolios (owner_id, institution_id, name, currency) VALUES (?, ?, 'P', 'EUR')`).run(userId, institutionId)
  const portfolioId = (sqlite.prepare('SELECT id FROM investment_portfolios WHERE owner_id = ?').get(userId) as { id: number }).id
  const instrumentId = Number(sqlite.prepare(
    `INSERT INTO instruments (symbol, name, cluster, currency) VALUES (?, 'ETF test', 'etf', 'EUR')`,
  ).run(`NWH${Date.now()}`).lastInsertRowid)
  const buy = (date: string, qty: string, price: string) => sqlite.prepare(
    `INSERT INTO investment_txns (owner_id, portfolio_id, instrument_id, type, trade_date, quantity, unit_price, currency)
     VALUES (?, ?, ?, 'buy', ?, ?, ?, 'EUR')`,
  ).run(userId, portfolioId, instrumentId, date, qty, price)
  buy('2026-04-01', '10', '100')
  buy('2026-04-10', '5', '110')
  sqlite.prepare(`INSERT INTO price_history (instrument_id, date, price, currency) VALUES (?, '2026-04-03', '105', 'EUR'), (?, '2026-04-10', '110', 'EUR')`)
    .run(instrumentId, instrumentId)

  expect(at('2026-03-31').investmentsEurMinor).toBe(0)
  // Prima del primo prezzo: costo di carico, punto incompleto.
  expect(at('2026-04-02')).toMatchObject({ investmentsEurMinor: 100_000, complete: false })
  expect(at('2026-04-05')).toMatchObject({ investmentsEurMinor: 105_000, complete: true })
  expect(at('2026-04-10').investmentsEurMinor).toBe(165_000)
  // Prezzo vecchio: si usa l'ultimo noto, ma il punto è incompleto.
  expect(at('2026-05-30')).toMatchObject({ investmentsEurMinor: 165_000, complete: false })
  expect(firstReconstructableDate(userId)).toBe('2026-04-01')
})

test('beni: valutazione più vicina; prima della prima valutazione la più vecchia', () => {
  const assetId = Number(sqlite.prepare(
    `INSERT INTO assets (owner_id, name, kind, value_minor, currency) VALUES (?, 'Auto', 'vehicle', 800000, 'EUR')`,
  ).run(userId).lastInsertRowid)
  sqlite.prepare(`INSERT INTO asset_valuations (asset_id, date, value_minor, currency) VALUES (?, '2026-05-01', 1000000, 'EUR'), (?, '2026-08-01', 900000, 'EUR')`)
    .run(assetId, assetId)
  expect(at('2026-01-01').otherAssetsEurMinor).toBe(1_000_000)
  expect(at('2026-06-01').otherAssetsEurMinor).toBe(1_000_000)
  expect(at('2026-08-15').otherAssetsEurMinor).toBe(900_000)
})

test('storico prima degli snapshot: dal primo movimento al giorno precedente', () => {
  const id = account()
  txn(id, '2026-06-28', 1_000)
  expect(historyBeforeSnapshots(userId, null)).toEqual([])
  expect(historyBeforeSnapshots(userId, '2026-06-28')).toEqual([])
  expect(historyBeforeSnapshots(userId, '2026-07-01').map((p) => p.date)).toEqual(['2026-06-28', '2026-06-29', '2026-06-30'])
})
