// src/lib/tax/income.ts — Stima imposta sul reddito (IRPEF / forfettario).
// Funzione pura: nessuna chiamata DB, nessun side-effect.
// Aritmetica in Decimal (no float rounding); round() solo al bordo di output.
import { dec } from '@/lib/money'
import type { UserProfile } from '@/lib/userSettings'
import {
  irpefBrackets,
  FORFETTARIO_RATE_STD,
  FORFETTARIO_RATE_STARTUP,
  ADDIZIONALI_STIMATE_RATE,
} from './rates'

// ── Tipi pubblici ─────────────────────────────────────────────────────────────

export interface IrpefBracketResult {
  rate:       number   // aliquota marginale
  taxedMinor: number   // reddito tassato a questo scaglione (EUR minor)
  taxMinor:   number   // imposta prodotta da questo scaglione (EUR minor)
}

export interface IncomeTaxEstimate {
  /** false → non calcolabile (residenza estera o tipo impiego non fornito/none) */
  applicable:        boolean
  /** Imponibile al netto di eventuali riduzioni forfettarie (EUR minor) */
  taxableMinor:      number
  /** IRPEF a scaglioni (0 nel forfettario) */
  irpefMinor:        number
  /** Imposta sostitutiva forfettario (0 negli altri regimi) */
  substituteMinor:   number
  /** Stima addizionali regionali + comunali (0 nel forfettario) */
  addizionaliMinor:  number
  /** Totale imposta stimata (EUR minor) */
  totalMinor:        number
  /** Aliquota effettiva totale sul reddito lordo */
  effectiveRate:     number
  /** Dettaglio scaglioni IRPEF (vuoto nel forfettario) */
  brackets:          IrpefBracketResult[]
  /** Avviso sui limiti della stima (es. detrazioni non calcolate, residenza estera) */
  note:              string | null
}

// ── Helper: età da data di nascita ────────────────────────────────────────────

/** Calcola l'età in anni interi dalla data di nascita ISO. Null se data non valida. */
export function ageFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null
  const born = new Date(birthDate)
  if (isNaN(born.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - born.getFullYear()
  const hasBirthdayPassed =
    today.getMonth() > born.getMonth() ||
    (today.getMonth() === born.getMonth() && today.getDate() >= born.getDate())
  if (!hasBirthdayPassed) age -= 1
  return age
}

// ── Helper: IRPEF a scaglioni ─────────────────────────────────────────────────

/**
 * Calcola l'IRPEF lorda a scaglioni sul reddito imponibile.
 * Restituisce l'imposta per scaglione e il totale, tutti in EUR minor units.
 * Nessuna detrazione applicata — la stima le dichiara nel campo `note`.
 */
export function computeIrpefBrackets(
  taxableMinor: number,
  bracketsDef: { upToMinor: number; rate: number }[] = irpefBrackets(new Date().getFullYear()),
): { brackets: IrpefBracketResult[]; totalMinor: number } {
  if (taxableMinor <= 0) return { brackets: [], totalMinor: 0 }

  const brackets: IrpefBracketResult[] = []
  let remaining = dec(taxableMinor.toString())
  let prevUpTo  = dec('0')

  for (const { upToMinor, rate } of bracketsDef) {
    if (remaining.lte(0)) break
    const bracketWidth = upToMinor === Infinity
      ? remaining
      : dec(Math.min(upToMinor, taxableMinor).toString()).minus(prevUpTo)
    if (bracketWidth.lte(0)) {
      prevUpTo = dec(upToMinor.toString())
      continue
    }
    const taxedInBracket = remaining.gte(bracketWidth) ? bracketWidth : remaining
    const taxInBracket   = taxedInBracket.mul(rate)
    brackets.push({
      rate,
      taxedMinor: Math.round(taxedInBracket.toNumber()),
      taxMinor:   Math.round(taxInBracket.toNumber()),
    })
    remaining = remaining.minus(taxedInBracket)
    if (upToMinor !== Infinity) prevUpTo = dec(upToMinor.toString())
  }

  const totalMinor = brackets.reduce((sum, b) => sum + b.taxMinor, 0)
  return { brackets, totalMinor }
}

// ── Funzione principale ───────────────────────────────────────────────────────

/**
 * Stima l'imposta sul reddito da lavoro/pensione sulla base del profilo utente.
 *
 * Limiti dichiarati:
 * - Detrazioni da lavoro dipendente/pensione **non calcolate** (variano per reddito e tipologia).
 * - Addizionali regionali/comunali stimate forfettariamente al 2%.
 * - Contributi INPS esclusi dalla stima (dipendono dal regime previdenziale).
 * - Residenza estera: il regime IRPEF italiano potrebbe non applicarsi (CFC, convenzioni, ecc.).
 */
export function estimateIncomeTax(
  p: UserProfile,
  year: number = new Date().getFullYear(),
): IncomeTaxEstimate {
  const NOT_APPLICABLE: IncomeTaxEstimate = {
    applicable: false, taxableMinor: 0, irpefMinor: 0,
    substituteMinor: 0, addizionaliMinor: 0, totalMinor: 0,
    effectiveRate: 0, brackets: [], note: null,
  }

  // Residenza estera → non modelliamo
  if (!p.taxResidency || p.taxResidency.toUpperCase() !== 'IT') {
    return {
      ...NOT_APPLICABLE,
      note: 'Residenza fiscale non italiana: la stima IRPEF non è disponibile. '
          + 'Consulta un professionista per il regime fiscale del tuo Paese.',
    }
  }

  // Tipo impiego non fornito o "none" → non calcolabile
  if (!p.employmentType || p.employmentType === 'none') {
    return {
      ...NOT_APPLICABLE,
      note: 'Completa il tipo di impiego nel profilo per ottenere la stima IRPEF.',
    }
  }

  const grossMinor = p.annualGrossIncomeMinor ?? 0
  if (grossMinor <= 0) {
    return {
      ...NOT_APPLICABLE,
      applicable: true,
      note: 'Inserisci il reddito annuo lordo nel profilo per ottenere la stima IRPEF.',
    }
  }

  // ── Regime forfettario ──────────────────────────────────────────────────────
  if (p.employmentType === 'self_employed_forfettario') {
    const coeff   = Math.max(0, Math.min(100, p.forfettarioCoefficient ?? 78))
    const taxable = Math.round(dec(grossMinor.toString()).mul(coeff).div(100).toNumber())
    const rate    = p.forfettarioStartup ? FORFETTARIO_RATE_STARTUP : FORFETTARIO_RATE_STD
    const sub     = Math.round(dec(taxable.toString()).mul(rate).toNumber())
    const total   = sub
    const effRate = grossMinor > 0 ? total / grossMinor : 0
    return {
      applicable:       true,
      taxableMinor:     taxable,
      irpefMinor:       0,
      substituteMinor:  sub,
      addizionaliMinor: 0,
      totalMinor:       total,
      effectiveRate:    effRate,
      brackets:         [],
      note: `Regime forfettario: imponibile = reddito × ${coeff}%; `
          + `imposta sostitutiva ${(rate * 100).toFixed(0)}%. `
          + 'Contributi INPS e detrazioni esclusi dalla stima.',
    }
  }

  // ── IRPEF a scaglioni (dipendente, pensionato, autonomo ordinario) ──────────
  const taxableMinor        = grossMinor   // no riduzione forfettaria
  const { brackets, totalMinor: irpefGross } = computeIrpefBrackets(taxableMinor, irpefBrackets(year))
  const addizionali         = Math.round(dec(taxableMinor.toString()).mul(ADDIZIONALI_STIMATE_RATE).toNumber())
  const total               = irpefGross + addizionali
  const effRate             = grossMinor > 0 ? total / grossMinor : 0

  const employmentNote: Record<string, string> = {
    employee:                'Dipendente: detrazioni da lavoro e familiari non incluse — la stima è in eccesso.',
    pensioner:               'Pensionato: detrazioni da pensione non incluse — la stima è in eccesso.',
    self_employed_ordinario: 'Autonomo in regime ordinario: detrazioni e contributi INPS non inclusi.',
  }
  const note = (employmentNote[p.employmentType] ?? '') +
    ` Addizionali regionali/comunali stimate forfettariamente al ${(ADDIZIONALI_STIMATE_RATE * 100).toFixed(0)}%.`

  return {
    applicable:       true,
    taxableMinor,
    irpefMinor:       irpefGross,
    substituteMinor:  0,
    addizionaliMinor: addizionali,
    totalMinor:       total,
    effectiveRate:    effRate,
    brackets,
    note,
  }
}
