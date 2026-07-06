// Per-user settings repository. Stores encrypted OpenAI API key and user profile.
import { sqlite } from '@/db'
import { encryptSecret, decryptSecret } from '@/lib/crypto'
import type { UserSettings } from '@/db/schema'

export type EmploymentType =
  | 'employee'
  | 'self_employed_forfettario'
  | 'self_employed_ordinario'
  | 'pensioner'
  | 'none'

export type CapitalGainsRegime = 'amministrato' | 'dichiarativo'

export interface UserProfile {
  taxResidency:           string            // ISO alpha-2, default 'IT'
  birthDate:              string | null     // ISO YYYY-MM-DD
  displayName:            string | null     // override nome sidebar
  employmentType:         EmploymentType | null
  capitalGainsRegime:     CapitalGainsRegime | null
  annualGrossIncomeMinor: number | null     // EUR minor units
  forfettarioCoefficient: number | null     // % 0-100
  forfettarioStartup:     boolean           // 5% agevolata vs 15%
  irpefMarginalRate:      number | null     // es. 0.23 / 0.35 / 0.43 — impostato manualmente
}

function row(userId: number): UserSettings | undefined {
  return sqlite
    .prepare(`SELECT * FROM user_settings WHERE user_id = ?`)
    .get(userId) as UserSettings | undefined
}

export function hasOpenAiKey(userId: number): boolean {
  const r = sqlite
    .prepare(`SELECT openai_api_key_enc FROM user_settings WHERE user_id = ?`)
    .get(userId) as { openai_api_key_enc: string | null } | undefined
  return r?.openai_api_key_enc != null
}

export function getOpenAiKeySetAt(userId: number): number | null {
  const r = row(userId)
  return r?.openai_key_set_at ?? null
}

export function setOpenAiKey(userId: number, plainKey: string): void {
  const enc = encryptSecret(plainKey)
  const now = Math.floor(Date.now() / 1000)
  sqlite.prepare(`
    INSERT INTO user_settings (user_id, openai_api_key_enc, openai_key_set_at)
    VALUES (?, ?, ?)
    ON CONFLICT (user_id) DO UPDATE SET
      openai_api_key_enc = excluded.openai_api_key_enc,
      openai_key_set_at  = excluded.openai_key_set_at
  `).run(userId, enc, now)
}

export function getOpenAiKey(userId: number): string | null {
  const r = row(userId)
  if (!r?.openai_api_key_enc) return null
  try {
    return decryptSecret(r.openai_api_key_enc)
  } catch {
    return null
  }
}

export function clearOpenAiKey(userId: number): void {
  sqlite.prepare(`
    UPDATE user_settings
    SET openai_api_key_enc = NULL, openai_key_set_at = NULL
    WHERE user_id = ?
  `).run(userId)
}

// ── Profilo personale / dati fiscali ─────────────────────────────────────────

const VALID_EMPLOYMENT: EmploymentType[] = [
  'employee', 'self_employed_forfettario', 'self_employed_ordinario', 'pensioner', 'none',
]
const VALID_CG_REGIME: CapitalGainsRegime[] = ['amministrato', 'dichiarativo']

function coerceEmploymentType(v: unknown): EmploymentType | null {
  return VALID_EMPLOYMENT.includes(v as EmploymentType) ? (v as EmploymentType) : null
}
function coerceCgRegime(v: unknown): CapitalGainsRegime | null {
  return VALID_CG_REGIME.includes(v as CapitalGainsRegime) ? (v as CapitalGainsRegime) : null
}

/** Legge il profilo utente con default sensati per i campi mancanti. */
export function getUserProfile(userId: number): UserProfile {
  const r = row(userId)
  return {
    taxResidency:           (r as Record<string, unknown>)?.tax_residency as string ?? 'IT',
    birthDate:              (r as Record<string, unknown>)?.birth_date as string | null ?? null,
    displayName:            (r as Record<string, unknown>)?.display_name as string | null ?? null,
    employmentType:         coerceEmploymentType((r as Record<string, unknown>)?.employment_type),
    capitalGainsRegime:     coerceCgRegime((r as Record<string, unknown>)?.capital_gains_regime),
    annualGrossIncomeMinor: (r as Record<string, unknown>)?.annual_gross_income_minor as number | null ?? null,
    forfettarioCoefficient: (r as Record<string, unknown>)?.forfettario_coefficient as number | null ?? null,
    forfettarioStartup:     !!((r as Record<string, unknown>)?.forfettario_startup),
    irpefMarginalRate:      parseFloat((r as Record<string, unknown>)?.irpef_marginal_rate as string) || null,
  }
}

// ── Layout widget dashboard ───────────────────────────────────────────────────

export type WidgetId   = 'goals' | 'budget' | 'investments' | 'deadlines' | 'news'
export type WidgetSize = 'sm' | 'md' | 'lg'

export interface WidgetConfig {
  id:      WidgetId
  visible: boolean
  size:    WidgetSize
}

const ALL_WIDGET_IDS:  WidgetId[]   = ['investments', 'goals', 'budget', 'deadlines', 'news']
const VALID_SIZES:     WidgetSize[] = ['sm', 'md', 'lg']

export const DEFAULT_LAYOUT: WidgetConfig[] = ALL_WIDGET_IDS.map(id => ({
  id, visible: true, size: 'md' as const,
}))

/** Restituisce il layout widget salvato, o il default se non configurato / non valido. */
export function getDashboardLayout(userId: number): WidgetConfig[] {
  const r = row(userId)
  const raw = (r as Record<string, unknown>)?.dashboard_layout as string | null ?? null
  if (!raw) return DEFAULT_LAYOUT
  try {
    const parsed = JSON.parse(raw) as unknown[]
    if (!Array.isArray(parsed)) return DEFAULT_LAYOUT
    const valid = parsed
      .filter((x): x is WidgetConfig =>
        typeof x === 'object' && x !== null &&
        typeof (x as WidgetConfig).id === 'string' &&
        ALL_WIDGET_IDS.includes((x as WidgetConfig).id) &&
        typeof (x as WidgetConfig).visible === 'boolean',
      )
      .map(x => ({
        ...x,
        // retrocompatibilità: se size manca o non valido, usa 'md'
        size: VALID_SIZES.includes((x as WidgetConfig).size) ? (x as WidgetConfig).size : ('md' as const),
      }))
    // Aggiunge widget nuovi (aggiunti dopo che l'utente ha salvato il layout)
    const existingIds = new Set(valid.map(w => w.id))
    const missing = ALL_WIDGET_IDS
      .filter(id => !existingIds.has(id))
      .map(id => ({ id, visible: true, size: 'md' as const }))
    return [...valid, ...missing]
  } catch {
    return DEFAULT_LAYOUT
  }
}

/** Persiste il layout widget (UPSERT). */
export function setDashboardLayout(userId: number, layout: WidgetConfig[]): void {
  sqlite.prepare(`
    INSERT INTO user_settings (user_id, dashboard_layout)
    VALUES (?, ?)
    ON CONFLICT (user_id) DO UPDATE SET
      dashboard_layout = excluded.dashboard_layout
  `).run(userId, JSON.stringify(layout))
}

/** Aggiorna i campi del profilo (UPSERT). Solo i campi forniti vengono scritti. */
export function setUserProfile(userId: number, p: Partial<UserProfile>): void {
  sqlite.prepare(`
    INSERT INTO user_settings (user_id,
      tax_residency, birth_date, display_name,
      employment_type, capital_gains_regime,
      annual_gross_income_minor, forfettario_coefficient, forfettario_startup,
      irpef_marginal_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_id) DO UPDATE SET
      tax_residency              = COALESCE(excluded.tax_residency,              tax_residency),
      birth_date                 = excluded.birth_date,
      display_name               = excluded.display_name,
      employment_type            = excluded.employment_type,
      capital_gains_regime       = excluded.capital_gains_regime,
      annual_gross_income_minor  = excluded.annual_gross_income_minor,
      forfettario_coefficient    = excluded.forfettario_coefficient,
      forfettario_startup        = excluded.forfettario_startup,
      irpef_marginal_rate        = excluded.irpef_marginal_rate
  `).run(
    userId,
    p.taxResidency ?? null,
    p.birthDate    ?? null,
    p.displayName  ?? null,
    p.employmentType         ?? null,
    p.capitalGainsRegime     ?? null,
    p.annualGrossIncomeMinor ?? null,
    p.forfettarioCoefficient ?? null,
    p.forfettarioStartup ? 1 : 0,
    p.irpefMarginalRate != null ? String(p.irpefMarginalRate) : null,
  )
}
