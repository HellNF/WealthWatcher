'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import { setUserProfile } from '@/lib/userSettings'
import { toMinor } from '@/lib/money'

export type ActionState = { error?: string; success?: string } | undefined

const EMPLOYMENT_VALUES = [
  'employee', 'self_employed_forfettario', 'self_employed_ordinario', 'pensioner', 'none',
] as const

const profileSchema = z.object({
  display_name:       z.string().trim().max(100).optional(),
  birth_date:         z.string().trim()
    .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Data non valida')
    .optional(),
  tax_residency:      z.string().trim().length(2, 'Codice paese ISO 2 lettere').toUpperCase()
    .default('IT'),
  employment_type:    z.enum(EMPLOYMENT_VALUES).optional(),
  capital_gains_regime: z.enum(['amministrato', 'dichiarativo']).optional(),
  // reddito annuo lordo in €, stringa decimale → convertita in minor units
  annual_gross_income: z.string().trim()
    .transform((v) => v.replace(',', '.'))
    .optional(),
  forfettario_coefficient: z.string().trim()
    .transform((v) => v.replace(',', '.'))
    .optional(),
  forfettario_startup: z.string().optional(),  // 'on' se checkbox spuntata
})

export async function saveProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()

  const raw = {
    display_name:            formData.get('display_name')            || undefined,
    birth_date:              formData.get('birth_date')              || undefined,
    tax_residency:           formData.get('tax_residency')           || 'IT',
    employment_type:         formData.get('employment_type')         || undefined,
    capital_gains_regime:    formData.get('capital_gains_regime')    || undefined,
    annual_gross_income:     formData.get('annual_gross_income')     || undefined,
    forfettario_coefficient: formData.get('forfettario_coefficient') || undefined,
    forfettario_startup:     formData.get('forfettario_startup')     || undefined,
  }

  const parsed = profileSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi' }
  }

  const d = parsed.data

  // Converti reddito lordo in minor units (stringa € → centesimi)
  let annualGrossIncomeMinor: number | null = null
  if (d.annual_gross_income && d.annual_gross_income !== '') {
    const parsed_income = parseFloat(d.annual_gross_income)
    if (isNaN(parsed_income) || parsed_income < 0)
      return { error: 'Reddito annuo lordo non valido' }
    annualGrossIncomeMinor = toMinor(d.annual_gross_income, 'EUR')
  }

  // Coefficiente forfettario: percentuale intera 0–100
  let forfettarioCoefficient: number | null = null
  if (d.forfettario_coefficient && d.forfettario_coefficient !== '') {
    const c = parseFloat(d.forfettario_coefficient)
    if (isNaN(c) || c < 0 || c > 100)
      return { error: 'Coefficiente redditività deve essere tra 0 e 100' }
    forfettarioCoefficient = Math.round(c)
  }

  try {
    setUserProfile(user.id, {
      displayName:            d.display_name    || null,
      birthDate:              d.birth_date      || null,
      taxResidency:           d.tax_residency,
      employmentType:         (d.employment_type as 'employee' | 'self_employed_forfettario' | 'self_employed_ordinario' | 'pensioner' | 'none') ?? null,
      capitalGainsRegime:     (d.capital_gains_regime as 'amministrato' | 'dichiarativo') ?? null,
      annualGrossIncomeMinor,
      forfettarioCoefficient,
      forfettarioStartup:     d.forfettario_startup === 'on',
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Errore durante il salvataggio' }
  }

  revalidatePath('/dashboard/profilo', 'page')
  revalidatePath('/dashboard')           // aggiorna nome in sidebar
  revalidatePath('/dashboard/tasse')     // aggiorna sezione IRPEF

  return { success: 'Profilo salvato correttamente.' }
}
