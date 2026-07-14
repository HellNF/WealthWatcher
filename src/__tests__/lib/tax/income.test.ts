// src/__tests__/lib/tax/income.test.ts — Test puri per estimateIncomeTax e helpers.
// Nessun DB richiesto: tutte le funzioni sono pure.

import {
  estimateIncomeTax,
  computeIrpefBrackets,
  ageFromBirthDate,
  type IncomeTaxEstimate,
} from '@/lib/tax/income'
import type { UserProfile } from '@/lib/userSettings'
import {
  FORFETTARIO_RATE_STD,
  FORFETTARIO_RATE_STARTUP,
  ADDIZIONALI_STIMATE_RATE,
  irpefBrackets,
} from '@/lib/tax/rates'

// Scaglioni pinnati per anno, così i test non dipendono dall'anno di sistema.
const B2025 = irpefBrackets(2025)
const B2026 = irpefBrackets(2026)

// ── Profilo base riutilizzato nei test ────────────────────────────────────────

const BASE: UserProfile = {
  taxResidency:           'IT',
  birthDate:              '1990-01-01',
  displayName:            null,
  employmentType:         'employee',
  capitalGainsRegime:     'amministrato',
  annualGrossIncomeMinor: null,
  forfettarioCoefficient: null,
  forfettarioStartup:     false,
}

// ── ageFromBirthDate ──────────────────────────────────────────────────────────

describe('ageFromBirthDate', () => {
  test('null → null', () => expect(ageFromBirthDate(null)).toBeNull())
  test('undefined → null', () => expect(ageFromBirthDate(undefined)).toBeNull())
  test('stringa invalida → null', () => expect(ageFromBirthDate('non-data')).toBeNull())
  test('calcola età corretta', () => {
    // A prescindere da oggi, nato nel 1990 → età ≥ 35 (2025)
    const age = ageFromBirthDate('1990-06-15')
    expect(age).not.toBeNull()
    expect(age!).toBeGreaterThanOrEqual(34)
    expect(age!).toBeLessThanOrEqual(36)
  })
})

// ── computeIrpefBrackets ─────────────────────────────────────────────────────

describe('computeIrpefBrackets', () => {
  test('reddito zero → nessun scaglione', () => {
    const { brackets, totalMinor } = computeIrpefBrackets(0)
    expect(brackets).toHaveLength(0)
    expect(totalMinor).toBe(0)
  })

  test('reddito sotto soglia 1° scaglione (€10.000 → 23%)', () => {
    const { totalMinor } = computeIrpefBrackets(1_000_000)  // €10.000
    expect(totalMinor).toBe(Math.round(1_000_000 * 0.23))   // €2.300
  })

  test('reddito esattamente al limite 1° scaglione (€28.000 → tutto al 23%)', () => {
    const { brackets, totalMinor } = computeIrpefBrackets(2_800_000)
    expect(brackets).toHaveLength(1)
    expect(totalMinor).toBe(Math.round(2_800_000 * 0.23))  // €6.440
  })

  test('2025 · reddito €30.000 → due scaglioni (23% su 28k + 35% su 2k)', () => {
    const { brackets, totalMinor } = computeIrpefBrackets(3_000_000, B2025)
    expect(brackets).toHaveLength(2)
    const expected = Math.round(2_800_000 * 0.23 + 200_000 * 0.35)
    expect(totalMinor).toBe(expected)
  })

  test('2025 · reddito esattamente al limite 2° scaglione (€50.000 → 23%+35%)', () => {
    const { brackets, totalMinor } = computeIrpefBrackets(5_000_000, B2025)
    expect(brackets).toHaveLength(2)
    const expected = Math.round(2_800_000 * 0.23 + 2_200_000 * 0.35)
    expect(totalMinor).toBe(expected)
  })

  test('2025 · reddito €70.000 → tre scaglioni (23%+35%+43%)', () => {
    const { brackets, totalMinor } = computeIrpefBrackets(7_000_000, B2025)
    expect(brackets).toHaveLength(3)
    const expected = Math.round(2_800_000 * 0.23 + 2_200_000 * 0.35 + 2_000_000 * 0.43)
    expect(totalMinor).toBe(expected)
  })

  test('2026 · il 2° scaglione scende al 33% (€30.000)', () => {
    const { brackets, totalMinor } = computeIrpefBrackets(3_000_000, B2026)
    expect(brackets).toHaveLength(2)
    expect(brackets[1].rate).toBe(0.33)
    const expected = Math.round(2_800_000 * 0.23 + 200_000 * 0.33)
    expect(totalMinor).toBe(expected)
  })
})

// ── estimateIncomeTax — residenza estera ─────────────────────────────────────

describe('estimateIncomeTax — residenza estera', () => {
  test('applicable=false + note per residenza FR', () => {
    const r = estimateIncomeTax({ ...BASE, taxResidency: 'FR', annualGrossIncomeMinor: 3_000_000 })
    expect(r.applicable).toBe(false)
    expect(r.totalMinor).toBe(0)
    expect(r.note).toMatch(/non italian/i)
  })

  test('applicable=false per residenza US', () => {
    const r = estimateIncomeTax({ ...BASE, taxResidency: 'US', annualGrossIncomeMinor: 5_000_000 })
    expect(r.applicable).toBe(false)
  })
})

// ── estimateIncomeTax — tipo impiego mancante / none ─────────────────────────

describe('estimateIncomeTax — impiego none/null', () => {
  test('employmentType null → applicable=false', () => {
    const r = estimateIncomeTax({ ...BASE, employmentType: null })
    expect(r.applicable).toBe(false)
    expect(r.totalMinor).toBe(0)
  })

  test('employmentType none → applicable=false', () => {
    const r = estimateIncomeTax({ ...BASE, employmentType: 'none' })
    expect(r.applicable).toBe(false)
  })
})

// ── estimateIncomeTax — reddito nullo ────────────────────────────────────────

describe('estimateIncomeTax — reddito nullo', () => {
  test('annualGrossIncomeMinor null → applicable=true, total=0', () => {
    const r = estimateIncomeTax({ ...BASE, employmentType: 'employee', annualGrossIncomeMinor: null })
    expect(r.applicable).toBe(true)
    expect(r.totalMinor).toBe(0)
    expect(r.note).toMatch(/reddito/i)
  })

  test('annualGrossIncomeMinor 0 → total=0', () => {
    const r = estimateIncomeTax({ ...BASE, employmentType: 'employee', annualGrossIncomeMinor: 0 })
    expect(r.totalMinor).toBe(0)
  })
})

// ── estimateIncomeTax — dipendente (IRPEF a scaglioni) ───────────────────────

describe('estimateIncomeTax — dipendente', () => {
  test('€35.000 → applicata, scaglioni 23%+35%, addizionali 2%', () => {
    const gross = 3_500_000  // €35.000
    const r = estimateIncomeTax({ ...BASE, annualGrossIncomeMinor: gross })
    expect(r.applicable).toBe(true)
    expect(r.irpefMinor).toBeGreaterThan(0)
    expect(r.substituteMinor).toBe(0)
    expect(r.addizionaliMinor).toBe(Math.round(gross * ADDIZIONALI_STIMATE_RATE))
    expect(r.totalMinor).toBe(r.irpefMinor + r.addizionaliMinor)
    expect(r.brackets).toHaveLength(2)
    // Aliquota effettiva tra 23% e 35% per €35k lordi
    expect(r.effectiveRate).toBeGreaterThan(0.23)
    expect(r.effectiveRate).toBeLessThan(0.35)
  })

  test('€28.000 esatti → un solo scaglione 23%', () => {
    const r = estimateIncomeTax({ ...BASE, annualGrossIncomeMinor: 2_800_000 })
    expect(r.brackets).toHaveLength(1)
    expect(r.brackets[0].rate).toBe(0.23)
  })
})

// ── estimateIncomeTax — pensionato ───────────────────────────────────────────

describe('estimateIncomeTax — pensionato', () => {
  test('stessa logica IRPEF del dipendente', () => {
    const gross = 2_000_000
    const rDip  = estimateIncomeTax({ ...BASE, employmentType: 'employee',  annualGrossIncomeMinor: gross })
    const rPen  = estimateIncomeTax({ ...BASE, employmentType: 'pensioner', annualGrossIncomeMinor: gross })
    expect(rPen.totalMinor).toBe(rDip.totalMinor)
    expect(rPen.note).toMatch(/pension/i)
  })
})

// ── estimateIncomeTax — autonomo ordinario ───────────────────────────────────

describe('estimateIncomeTax — autonomo ordinario', () => {
  test('€40.000 → IRPEF a scaglioni + addizionali, no sostitutiva', () => {
    const r = estimateIncomeTax({
      ...BASE, employmentType: 'self_employed_ordinario', annualGrossIncomeMinor: 4_000_000,
    })
    expect(r.applicable).toBe(true)
    expect(r.irpefMinor).toBeGreaterThan(0)
    expect(r.substituteMinor).toBe(0)
  })
})

// ── estimateIncomeTax — forfettario ─────────────────────────────────────────

describe('estimateIncomeTax — forfettario', () => {
  test('aliquota 15% coefficiente 78', () => {
    const gross = 3_000_000  // €30.000
    const r = estimateIncomeTax({
      ...BASE,
      employmentType:         'self_employed_forfettario',
      annualGrossIncomeMinor: gross,
      forfettarioCoefficient: 78,
      forfettarioStartup:     false,
    })
    expect(r.applicable).toBe(true)
    expect(r.irpefMinor).toBe(0)
    expect(r.addizionaliMinor).toBe(0)
    const expectedTaxable = Math.round(gross * 0.78)
    expect(r.taxableMinor).toBe(expectedTaxable)
    expect(r.substituteMinor).toBe(Math.round(expectedTaxable * FORFETTARIO_RATE_STD))
    expect(r.totalMinor).toBe(r.substituteMinor)
    expect(r.brackets).toHaveLength(0)
  })

  test('aliquota startup 5% coefficiente 67', () => {
    const gross = 2_000_000  // €20.000
    const r = estimateIncomeTax({
      ...BASE,
      employmentType:         'self_employed_forfettario',
      annualGrossIncomeMinor: gross,
      forfettarioCoefficient: 67,
      forfettarioStartup:     true,
    })
    const expectedTaxable = Math.round(gross * 0.67)
    expect(r.taxableMinor).toBe(expectedTaxable)
    expect(r.substituteMinor).toBe(Math.round(expectedTaxable * FORFETTARIO_RATE_STARTUP))
  })

  test('coefficiente null → default 78', () => {
    const gross = 1_000_000
    const rExplicit = estimateIncomeTax({
      ...BASE, employmentType: 'self_employed_forfettario',
      annualGrossIncomeMinor: gross, forfettarioCoefficient: 78,
    })
    const rDefault = estimateIncomeTax({
      ...BASE, employmentType: 'self_employed_forfettario',
      annualGrossIncomeMinor: gross, forfettarioCoefficient: null,
    })
    expect(rDefault.taxableMinor).toBe(rExplicit.taxableMinor)
  })

  test('coefficiente clamped 0–100 (valore 150 → trattato come 100)', () => {
    const gross = 1_000_000
    const r = estimateIncomeTax({
      ...BASE, employmentType: 'self_employed_forfettario',
      annualGrossIncomeMinor: gross, forfettarioCoefficient: 150,
    })
    expect(r.taxableMinor).toBe(gross)  // 100% del reddito
  })
})
