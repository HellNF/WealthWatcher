// src/__tests__/lib/tax/wealth.test.ts — Test puri per helper bollo/IVAFE e giacenza media.
// I calcoli con sqlite (estimatedWealthTaxes, accountAverageBalanceMinor) non sono testati
// qui perché richiedono un DB; si testano solo le funzioni pure esportate.
import {
  stampDutyAccountMinor,
  wealthDutySecuritiesMinor,
  isForeign,
  BOLLO_CONTI_EUR_MINOR,
  BOLLO_SOGLIA_EUR_MINOR,
} from '@/lib/tax/rates'
import { averageBalanceFromMovements } from '@/lib/accounts'

// ── stampDutyAccountMinor ─────────────────────────────────────────────────────

describe('stampDutyAccountMinor', () => {
  test('giacenza = 0 → imposta = 0', () => {
    expect(stampDutyAccountMinor(0, 1)).toBe(0)
  })

  test('giacenza esattamente €5.000 → imposta = 0 (soglia non superata)', () => {
    expect(stampDutyAccountMinor(BOLLO_SOGLIA_EUR_MINOR, 1)).toBe(0)
  })

  test('giacenza €5.001 → imposta = €34,20 (anno intero)', () => {
    expect(stampDutyAccountMinor(500_001, 1.0)).toBe(BOLLO_CONTI_EUR_MINOR)
  })

  test('giacenza €20.000 → imposta = €34,20 (anno intero)', () => {
    expect(stampDutyAccountMinor(2_000_000, 1.0)).toBe(3_420)
  })

  test('giacenza €20.000, conto aperto metà anno (0.5) → pro-rata €17,10', () => {
    expect(stampDutyAccountMinor(2_000_000, 0.5)).toBe(1_710)
  })

  test('giacenza €20.000, fractionOfYear = 0 → imposta = 0', () => {
    expect(stampDutyAccountMinor(2_000_000, 0)).toBe(0)
  })

  test('fractionOfYear > 1 è clampato a 1', () => {
    expect(stampDutyAccountMinor(2_000_000, 2)).toBe(BOLLO_CONTI_EUR_MINOR)
  })

  test('giacenza €5.000 - 1 minor → imposta = 0 (esattamente sotto soglia)', () => {
    expect(stampDutyAccountMinor(499_999, 1)).toBe(0)
  })
})

// ── wealthDutySecuritiesMinor ─────────────────────────────────────────────────

describe('wealthDutySecuritiesMinor', () => {
  test('0 → 0', () => {
    expect(wealthDutySecuritiesMinor(0)).toBe(0)
  })

  test('€10.000 → 0,2% = €20,00 (2000 minor)', () => {
    expect(wealthDutySecuritiesMinor(1_000_000)).toBe(2_000)
  })

  test('€50.000 → 0,2% = €100,00 (10000 minor)', () => {
    expect(wealthDutySecuritiesMinor(5_000_000)).toBe(10_000)
  })

  test('arrotondamento: €3.333,33 → 0,2% = €6,67 (round)', () => {
    // 333_333 × 0.002 = 666.666 → round → 667
    expect(wealthDutySecuritiesMinor(333_333)).toBe(667)
  })

  test('restituisce un intero (minor units)', () => {
    const result = wealthDutySecuritiesMinor(123_456)
    expect(Number.isInteger(result)).toBe(true)
  })
})

// ── isForeign ─────────────────────────────────────────────────────────────────

describe('isForeign', () => {
  test('null → false (default italiano)', () => {
    expect(isForeign(null)).toBe(false)
  })

  test('undefined → false', () => {
    expect(isForeign(undefined)).toBe(false)
  })

  test("'' → false (stringa vuota = Italia)", () => {
    expect(isForeign('')).toBe(false)
  })

  test("'IT' → false", () => {
    expect(isForeign('IT')).toBe(false)
  })

  test("'it' (minuscolo) → false", () => {
    expect(isForeign('it')).toBe(false)
  })

  test("'IE' → true (Irlanda)", () => {
    expect(isForeign('IE')).toBe(true)
  })

  test("'DE' → true (Germania)", () => {
    expect(isForeign('DE')).toBe(true)
  })

  test("'US' → true (USA)", () => {
    expect(isForeign('US')).toBe(true)
  })

  test("' IE ' con spazi → true (trimming)", () => {
    expect(isForeign(' IE ')).toBe(true)
  })
})

// ── averageBalanceFromMovements ────────────────────────────────────────────────

describe('averageBalanceFromMovements', () => {
  // Nota: usiamo l'anno 2025 (già trascorso) per evitare dipendenze da "today"
  // nell'algoritmo di effectiveEnd.
  const YEAR = '2025'

  test('nessun movimento, saldo costante €10.000 → giacenza media = €10.000', () => {
    const { giacenzaMediaMinor, fractionOfYear } = averageBalanceFromMovements(
      1_000_000,  // saldo corrente: €10.000
      [],         // nessun movimento
      YEAR,
      null,
    )
    expect(giacenzaMediaMinor).toBe(1_000_000)
    expect(fractionOfYear).toBe(1.0)
  })

  test('deposito a metà anno: prima metà €5.000, seconda €10.000 → media ≈ €7.500', () => {
    // Saldo corrente (fine 2025) = €10.000
    // Movimento +€5.000 il 1° luglio 2025
    const { giacenzaMediaMinor } = averageBalanceFromMovements(
      1_000_000,  // €10.000 al 31/12/2025
      [{ booked_date: '2025-07-01', amount_minor: 500_000 }],  // +€5.000
      YEAR,
      null,
    )
    // Prima di luglio: €5.000 (≈ 181 giorni: 1/1–30/6)
    // Da luglio in poi: €10.000 (≈ 184 giorni: 1/7–31/12)
    // Media ≈ (5000×181 + 10000×184) / 365 ≈ 7493
    expect(giacenzaMediaMinor).toBeGreaterThan(7_400_00)   // > €7.400
    expect(giacenzaMediaMinor).toBeLessThan(7_600_00)      // < €7.600
  })

  test('prelievo a fine anno: quasi tutto il tempo €10.000, ultimi giorni €5.000', () => {
    // Saldo corrente (fine 2025) = €5.000
    // Prelievo di €5.000 il 20/12/2025
    const { giacenzaMediaMinor } = averageBalanceFromMovements(
      500_000,    // €5.000 al 31/12
      [{ booked_date: '2025-12-20', amount_minor: -500_000 }],  // -€5.000
      YEAR,
      null,
    )
    // Giorni 1/1–19/12: saldo €10.000 (353 giorni)
    // Giorni 20/12–31/12: saldo €5.000 (12 giorni)
    // Media ≈ (10000×353 + 5000×12) / 365 ≈ 9822
    expect(giacenzaMediaMinor).toBeGreaterThan(970_000)   // > €9.700
    expect(giacenzaMediaMinor).toBeLessThan(1_000_000)    // < €10.000
  })

  test('fractionOfYear = 1 se anchor prima dell\'anno', () => {
    const { fractionOfYear } = averageBalanceFromMovements(
      500_000,
      [{ booked_date: '2025-03-01', amount_minor: 100_000 }],
      YEAR,
      '2024-12-01',  // anchor prima del 2025
    )
    expect(fractionOfYear).toBe(1.0)
  })

  test('fractionOfYear < 1 se primo movimento in corso d\'anno', () => {
    // Primo movimento il 1° luglio: conto aperto a metà anno
    const { fractionOfYear } = averageBalanceFromMovements(
      500_000,
      [{ booked_date: '2025-07-01', amount_minor: 500_000 }],
      YEAR,
      null,  // nessun anchor
    )
    // 184 giorni su 365 ≈ 0.50
    expect(fractionOfYear).toBeGreaterThan(0.49)
    expect(fractionOfYear).toBeLessThan(0.52)
  })

  test('saldo negativo (scoperto) → giacenza media negativa', () => {
    const { giacenzaMediaMinor } = averageBalanceFromMovements(
      -100_000,  // -€1.000
      [],
      YEAR,
      null,
    )
    expect(giacenzaMediaMinor).toBe(-100_000)
  })

  test('più movimenti nello stesso giorno sono aggregati correttamente', () => {
    // Due movimenti lo stesso giorno: +€3.000 e +€2.000 = +€5.000 totale
    // Saldo finale = €5.000, saldo prima del giorno = 0
    const { giacenzaMediaMinor } = averageBalanceFromMovements(
      500_000,   // €5.000 al 31/12/2025
      [
        { booked_date: '2025-07-01', amount_minor: 300_000 },
        { booked_date: '2025-07-01', amount_minor: 200_000 },
      ],
      YEAR,
      null,
    )
    // Prima di luglio: €0 (181 giorni), dopo: €5.000 (184 giorni)
    // Media ≈ (0×181 + 5000×184) / 365 ≈ 2521
    expect(giacenzaMediaMinor).toBeGreaterThan(240_000)
    expect(giacenzaMediaMinor).toBeLessThan(260_000)
  })
})
