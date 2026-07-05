'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import { createMortgage, updateMortgage, deleteMortgage } from '@/lib/mortgages'

type ActionState = { error?: string } | undefined

const dec = (v: string) => v.replace(',', '.')

const mortgageSchema = z.object({
  name:                z.string().min(1, 'Il nome è obbligatorio'),
  initial_capital:     z.string().transform(v => {
    const n = parseFloat(dec(v)); if (!isFinite(n) || n <= 0) throw new Error('Importo non valido'); return n
  }),
  annual_interest_rate: z.string().transform(v => {
    const n = parseFloat(dec(v)); if (!isFinite(n) || n < 0 || n > 1) throw new Error('Inserisci il tasso in decimale (es. 0.035 per 3,5%)'); return n
  }),
  duration_months:     z.string().transform(v => {
    const n = parseInt(v, 10); if (!Number.isInteger(n) || n <= 0) throw new Error('Durata non valida'); return n
  }),
  start_date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida'),
  associated_account_id: z.string().optional().transform(v => v && v !== '' ? parseInt(v, 10) : null),
})

export async function createMortgageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()

  const parse = mortgageSchema.safeParse({
    name:                 formData.get('name'),
    initial_capital:      formData.get('initial_capital'),
    annual_interest_rate: formData.get('annual_interest_rate'),
    duration_months:      formData.get('duration_months'),
    start_date:           formData.get('start_date'),
    associated_account_id: formData.get('associated_account_id'),
  })
  if (!parse.success) return { error: parse.error.issues[0].message }

  const d = parse.data
  createMortgage(user.id, {
    name:                d.name,
    initialCapitalMinor: Math.round(d.initial_capital * 100),
    annualInterestRate:  String(d.annual_interest_rate),
    durationMonths:      d.duration_months,
    startDate:           d.start_date,
    associatedAccountId: d.associated_account_id,
  })

  revalidatePath('/dashboard/mutui')
  return undefined
}

export async function deleteMortgageAction(id: number): Promise<void> {
  const user = await requireUser()
  deleteMortgage(user.id, id)
  revalidatePath('/dashboard/mutui')
}

export async function updateOutstandingAction(
  id: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user    = await requireUser()
  const raw     = String(formData.get('outstanding') ?? '').replace(',', '.')
  const amount  = parseFloat(raw)
  if (isNaN(amount) || amount < 0) return { error: 'Importo non valido' }

  updateMortgage(user.id, id, { currentOutstandingOverrideMinor: Math.round(amount * 100) })
  revalidatePath(`/dashboard/mutui/${id}`)
}
