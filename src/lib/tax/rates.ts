// src/lib/tax/rates.ts — Italian tax engine: constants and pure helpers.
// All intermediate arithmetic uses Decimal (no float rounding); round(x, 2)
// only at display/storage boundaries (Instruction 3 of the spec).
import { dec, Decimal } from '@/lib/money'

// ── Aliquote base (Art. 67–68 TUIR) ──────────────────────────────────────────

/** Standard rate: stocks, ETC, corporate bonds, generic ETF (and crypto fino al 2025). */
export const RATE_STANDARD = 0.26

/** Agevolata rate: White List government bonds (BTP, EU bonds, etc.) */
export const RATE_WHITELIST = 0.125

/**
 * Crypto annual exemption threshold — valore storico €2.000 (Art. 67 c. 1 lett. c-sexies TUIR,
 * L. 197/2022). Abolita dal 1° gennaio 2025 (L. 207/2024): usa `cryptoFranchigiaMinor(year)`
 * per il valore corretto per anno fiscale.
 * @deprecated per anni ≥ 2025; preferisci `cryptoFranchigiaMinor(year)`.
 */
export const CRYPTO_FRANCHIGIA_EUR_MINOR = 200_000 // €2,000.00

// ── Aliquota cripto e franchigia per anno fiscale ─────────────────────────────

/**
 * Aliquota sull'imposta sostitutiva delle plusvalenze cripto per anno fiscale.
 *  - fino al 2025: 26% (Art. 67 c. 1 lett. c-sexies TUIR)
 *  - dal 2026:     33% (L. Bilancio 2026)
 *
 * Nota: l'eccezione al 26% per gli "e-money token" in euro (MiCAR, Reg. UE 2023/1114) NON è
 * modellata — il motore non distingue il sottotipo di criptoattività. Documentato nella fonte.
 */
export function cryptoRate(year: number): number {
  return year >= 2026 ? 0.33 : 0.26
}

/**
 * Franchigia annua sulle plusvalenze cripto per anno fiscale, in EUR minor.
 *  - fino al 2024: €2.000 (sotto soglia → esenti)
 *  - dal 2025:     abolita (0) — ogni plusvalenza è tassabile
 */
export function cryptoFranchigiaMinor(year: number): number {
  return year <= 2024 ? 200_000 : 0
}

/**
 * Aliquota effettiva applicabile a un evento, risolvendo la regola cripto per anno.
 *  - cluster 'crypto' → `cryptoRate(year)`
 *  - ogni altro cluster → `syntheticRate(whitelistPct)` (invariante per anno)
 *
 * Punto unico dove convergono aliquota sintetica ETF e aliquota cripto year-aware.
 */
export function effectiveRate(
  cluster: string,
  whitelistPctStr: string | null | undefined,
  year: number,
): number {
  if (cluster === 'crypto') return cryptoRate(year)
  return syntheticRate(whitelistPctStr)
}

// ── Aliquota sintetica per ETF misti ─────────────────────────────────────────

/**
 * Compute the synthetic tax rate for an instrument given its White List percentage.
 *
 * α(w) = (w/100 × 0.125) + ((100 − w)/100 × 0.26)
 *
 * Examples:
 *   syntheticRate('0')   → 0.26   (full standard rate)
 *   syntheticRate('100') → 0.125  (full agevolata rate)
 *   syntheticRate('50')  → 0.1925 (mixed ETF)
 *
 * @param whitelistPctStr - decimal string 0–100, e.g. "0", "100", "42.5"
 */
export function syntheticRate(whitelistPctStr: string | null | undefined): number {
  const raw = (whitelistPctStr ?? '').trim()
  const w = dec(raw === '' ? '0' : raw)
  // Clamp to [0, 100] defensively
  const wClamped = Decimal.max(dec('0'), Decimal.min(dec('100'), w))

  const agevolataComponent = wClamped.div(100).mul(RATE_WHITELIST)
  const standardComponent  = dec('100').minus(wClamped).div(100).mul(RATE_STANDARD)
  return agevolataComponent.plus(standardComponent).toNumber()
}

// ── Scadenza crediti fiscali (Art. 68, c. 5 TUIR) ────────────────────────────

/**
 * Compute the expiry date of a tax-loss credit generated on `realizedDate`.
 *
 * Rule: the credit expires on 31 December of the 4th calendar year following
 * the year of realisation.
 *   e.g. realised on 2026-03-12 → expires 2030-12-31
 *        realised on 2030-12-31 → expires 2034-12-31
 *
 * @param realizedDate - ISO date string YYYY-MM-DD
 * @returns ISO date string YYYY-MM-DD
 */
export function expiryDate(realizedDate: string): string {
  const year = parseInt(realizedDate.slice(0, 4), 10)
  if (isNaN(year)) throw new Error(`Invalid date: ${realizedDate}`)
  return `${year + 4}-12-31`
}

// ── Tipo di reddito ───────────────────────────────────────────────────────────

/**
 * Italian tax income category for a capital gain/loss event.
 *
 * - 'diverse':  Redditi Diversi — compensabili con minusvalenze (azioni, bond, cripto, ETF in perdita)
 * - 'capitale': Redditi di Capitale — NON compensabili (ETF in plusvalenza)
 */
export type IncomeType = 'diverse' | 'capitale'

/**
 * Determine the income type for a sale event.
 *
 * The ETF asymmetry rule:
 *   - ETF gain  → reddito di capitale (not offset-eligible)
 *   - ETF loss  → reddito diverso (offset-eligible, generates credit)
 *   - All other clusters (stock, bond, crypto, other): always reddito diverso
 */
export function incomeType(cluster: string, grossGainMinor: number): IncomeType {
  if (cluster === 'etf' && grossGainMinor > 0) return 'capitale'
  return 'diverse'
}

// ── Imposte patrimoniali (Imposta di Bollo / IVAFE) ───────────────────────────

/**
 * Imposta di bollo fissa annua sui conti correnti e depositi (Art. 13 c. 2-bis D.P.R. 642/1972).
 * Equivalente IVAFE per i conti esteri (Art. 19 c. 18 D.L. 201/2011).
 * €34,20 fissi per ogni conto la cui giacenza media annua supera €5.000.
 */
export const BOLLO_CONTI_EUR_MINOR  = 3_420   // €34,20

/**
 * Soglia di giacenza media annua per l'imposta di bollo su conti correnti.
 * Il bollo scatta solo se la giacenza media supera €5.000.
 */
export const BOLLO_SOGLIA_EUR_MINOR = 500_000 // €5.000

/**
 * Aliquota imposta di bollo su prodotti finanziari (deposito titoli) e IVAFE su strumenti esteri.
 * 0,2% del controvalore al 31 dicembre.
 */
export const BOLLO_TITOLI_RATE = 0.002

/**
 * Calcola l'imposta di bollo/IVAFE su un conto corrente, con pro-rata per i giorni di apertura.
 *
 * @param giacenzaMediaEurMinor  giacenza media annua in EUR minor units
 * @param fractionOfYear         frazione dell'anno per cui il conto era aperto (0–1)
 * @returns importo imposta in EUR minor units (0 se sotto soglia)
 */
export function stampDutyAccountMinor(
  giacenzaMediaEurMinor: number,
  fractionOfYear: number,
): number {
  if (giacenzaMediaEurMinor <= BOLLO_SOGLIA_EUR_MINOR) return 0
  return BOLLO_CONTI_EUR_MINOR * Math.min(1, Math.max(0, fractionOfYear))
}

/**
 * Calcola l'imposta di bollo/IVAFE su prodotti finanziari (deposito titoli).
 * 0,2% del controvalore in EUR.
 *
 * @param valueEurMinor  controvalore in EUR minor units
 * @returns importo imposta in EUR minor units
 */
export function wealthDutySecuritiesMinor(valueEurMinor: number): number {
  return valueEurMinor * BOLLO_TITOLI_RATE
}

/**
 * Determina se un intermediario è estero (regime IVAFE) anziché italiano (regime bollo).
 * Restituisce `true` per qualunque Paese diverso da IT (o null/undefined → Italia).
 */
export function isForeign(country: string | null | undefined): boolean {
  if (!country) return false
  return country.trim().toUpperCase() !== 'IT'
}

// ── Previdenza complementare (Art. 10, c. 1, lett. e-ter TUIR) ───────────────

/**
 * Soglia massima di deducibilità IRPEF per i contributi a fondi pensione integrativi.
 * €5.164,57 annui (invariata dal 2007 al 2025). Aggiornata a €5.300 dal 2026:
 * usa `pensionDeductionLimitMinor(year)` per il valore corretto per anno.
 * @deprecated per anni ≥ 2026; preferisci `pensionDeductionLimitMinor(year)`.
 */
export const MAX_PENSION_DEDUCTION_EUR_MINOR = 516_457 // €5.164,57

/**
 * Massimale di deducibilità dei contributi a fondi pensione, per anno fiscale (EUR minor).
 *  - fino al 2025: €5.164,57 (Art. 10 c. 1 lett. e-bis TUIR)
 *  - dal 2026:     €5.300,00 (L. Bilancio 2026)
 */
export function pensionDeductionLimitMinor(year: number): number {
  return year >= 2026 ? 530_000 : 516_457
}

// ── IRPEF (riforma 3 aliquote) ───────────────────────────────────────────────

/**
 * Scaglioni IRPEF 2025 (riforma 3 aliquote — Legge di Bilancio 2025).
 * `upToMinor = Infinity` per l'ultimo scaglione aperto.
 * @deprecated per anni ≥ 2026 (2° scaglione al 33%); preferisci `irpefBrackets(year)`.
 */
export const IRPEF_BRACKETS: { upToMinor: number; rate: number }[] = [
  { upToMinor: 2_800_000, rate: 0.23 },   // 0–28.000 → 23%
  { upToMinor: 5_000_000, rate: 0.35 },   // 28.001–50.000 → 35%
  { upToMinor: Infinity,  rate: 0.43 },   // oltre 50.000 → 43%
]

/**
 * Scaglioni IRPEF per anno fiscale.
 *  - fino al 2025: 23% / 35% / 43%
 *  - dal 2026:     23% / 33% / 43% (il 2° scaglione 28.001–50.000 scende dal 35% al 33%)
 */
export function irpefBrackets(year: number): { upToMinor: number; rate: number }[] {
  const secondRate = year >= 2026 ? 0.33 : 0.35
  return [
    { upToMinor: 2_800_000, rate: 0.23 },
    { upToMinor: 5_000_000, rate: secondRate },
    { upToMinor: Infinity,  rate: 0.43 },
  ]
}

/** Imposta sostitutiva regime forfettario — aliquota ordinaria. */
export const FORFETTARIO_RATE_STD    = 0.15

/** Imposta sostitutiva regime forfettario — aliquota agevolata startup (≤ 5 anni). */
export const FORFETTARIO_RATE_STARTUP = 0.05

/**
 * Stima forfettaria addizionali regionali + comunali IRPEF.
 * Valore indicativo tipico nazionale; le addizionali variano per comune.
 */
export const ADDIZIONALI_STIMATE_RATE = 0.02
