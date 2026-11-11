// Dati di prova per il banco dei componenti. "worst" usa valori realistici o i
// limiti degli schemi: nomi conto/istituzione max 100 (zod in dashboard/actions.ts),
// email max 254 (settings/actions.ts); pattern delle regole e nomi categoria
// non hanno limite.

export interface Fixture {
  accounts:   { id: number; name: string }[]
  categories: { group: string; items: { id: number; name: string }[] }[]
  months:     string[]
  rulePattern: string
  email:      string
  /** Errore restituito da un servizio esterno (stima veicolo) */
  apiError:   string
  toast:      string
  /** Patrimonio in centesimi */
  netWorth:   number[]
}

const monthsBack = (n: number) => Array.from({ length: n }, (_, i) => {
  const d = new Date(Date.UTC(2026, 10 - i, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
})

export const FIXTURES = {
  demo: {
    accounts: [{ id: 1, name: 'Conto Fineco' }, { id: 2, name: 'Revolut' }, { id: 3, name: 'Carta Hype' }, { id: 4, name: 'Satispay' }],
    categories: [
      { group: 'Uscite', items: [{ id: 1, name: 'Spesa' }, { id: 2, name: 'Ristoranti' }, { id: 3, name: 'Trasporti' }] },
      { group: 'Entrate', items: [{ id: 4, name: 'Stipendio' }] },
    ],
    months: monthsBack(6),
    rulePattern: 'esselunga',
    email: 'mario@example.com',
    apiError: 'Servizio non raggiungibile',
    toast: 'Evento salvato',
    netWorth: [8_452_300, 8_517_045],
  },
  worst: {
    accounts: [
      { id: 1, name: 'Conto Corrente Ordinario Intestato a Aleksandra Wiśniewska-Kowalczyk e Christopher Montgomery III' }, // 100 caratteri
      { id: 2, name: 'Jo' },
      { id: 3, name: 'IT60X0542811101000000123456' },
      { id: 4, name: 'Đặng Thị Ngọc Hân — Ví điện tử' },
      ...Array.from({ length: 36 }, (_, i) => ({ id: 10 + i, name: `Carta prepagata ${i + 1}` })),
    ],
    categories: [
      { group: 'Uscite', items: [
        { id: 1, name: 'Abbonamenti e servizi digitali ricorrenti (streaming, cloud, software)' },
        { id: 2, name: 'Versicherungsbeiträge' },
        { id: 3, name: 'Spesa' },
        ...Array.from({ length: 40 }, (_, i) => ({ id: 100 + i, name: `Categoria importata ${i + 1}` })),
      ] },
      { group: 'Entrate', items: [{ id: 4, name: 'Rimborsi spese e note di credito da fornitori esteri' }] },
      { group: 'Altro', items: [{ id: 5, name: 'Giroconti' }] },
    ],
    months: monthsBack(120),
    rulePattern: 'pagamento pos 14/09/2026 ore 18:30 carta *1234 presso amzn mktp it*ab12cd34ef amazon.it/bill lu',
    email: 'bartholomew.fitzgerald@northwind-industries-holdings.example.com',
    apiError: 'TypeError: Cannot read properties of undefined (reading \'price\') at estimateVehicle (vehicleEstimate.ts:212) — HTTP 503 Service Temporarily Unavailable',
    toast: 'Import completato: 1.284 movimenti importati da «Conto Corrente Ordinario Intestato a Aleksandra Wiśniewska-Kowalczyk», 37 duplicati ignorati, 12 senza categoria.',
    netWorth: [-123_456_789_012, 1_234_567_890_123],
  },
  empty: {
    accounts: [],
    categories: [],
    months: [],
    rulePattern: '',
    email: '',
    apiError: '',
    toast: '',
    netWorth: [0, 0],
  },
  one: {
    accounts: [{ id: 1, name: 'Conto' }],
    categories: [{ group: 'Uscite', items: [{ id: 1, name: 'Spesa' }] }],
    months: monthsBack(1),
    rulePattern: 'a',
    email: 'a@b.co',
    apiError: 'Errore',
    toast: 'Ok',
    netWorth: [100, 199],
  },
} satisfies Record<string, Fixture>

export type FixtureId = keyof typeof FIXTURES
