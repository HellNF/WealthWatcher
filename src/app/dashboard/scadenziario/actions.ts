'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import { createCustomEvent, deleteCustomEvent } from '@/lib/calendar'

export type EventActionState = { error?: string } | undefined

const addEventSchema = z.object({
  date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida (YYYY-MM-DD)'),
  label:  z.string().trim().min(1, 'Descrizione obbligatoria').max(200),
  amount: z.string().trim().transform(v => v.replace(',', '.')).optional(),
  note:   z.string().trim().max(500).optional(),
})

export async function addCalendarEventAction(
  _prev: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const user = await requireUser()

  const raw = {
    date:   formData.get('date'),
    label:  formData.get('label'),
    amount: formData.get('amount') || undefined,
    note:   formData.get('note')   || undefined,
  }

  const parsed = addEventSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dati non validi' }

  const d = parsed.data
  let amountMinor = 0
  if (d.amount) {
    const n = parseFloat(d.amount)
    if (isNaN(n) || n < 0) return { error: 'Importo non valido' }
    amountMinor = Math.round(n * 100)
  }

  createCustomEvent(user.id, d.date, d.label, amountMinor, d.note)
  revalidatePath('/dashboard/scadenziario')
  return undefined
}

export async function deleteCalendarEventAction(eventId: number): Promise<void> {
  const user = await requireUser()
  deleteCustomEvent(user.id, eventId)
  revalidatePath('/dashboard/scadenziario')
}
