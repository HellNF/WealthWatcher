'use client'

import { useActionState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Button, Field, Input } from '@/components/ui'
import { useToast } from '@/components/ui/Toast'
import { addCalendarEventAction, type EventActionState } from './actions'

const LABEL_SUGGESTIONS = [
  'Saldo IRPEF', 'I Acconto IRPEF', 'II Acconto IRPEF',
  'Saldo IVA', 'Acconto IVA', 'IMU', 'TARI',
  'F24', 'Bollo auto', 'Assicurazione auto',
  'Canone affitto', 'Abbonamento annuale',
]

interface Props {
  defaultDate: string        // YYYY-MM-DD
  onClose:     () => void
}

export default function EventForm({ defaultDate, onClose }: Props) {
  const [state, action, pending] = useActionState<EventActionState, FormData>(addCalendarEventAction, undefined)
  const { toast } = useToast()
  const submittedRef = useRef(false)

  // Chiude il form e notifica dopo un inserimento andato a buon fine
  useEffect(() => {
    if (pending) { submittedRef.current = true; return }
    if (submittedRef.current && state === undefined) {
      submittedRef.current = false
      toast('Evento aggiunto allo scadenziario', 'success')
      onClose()
    }
  }, [pending, state, toast, onClose])

  return (
    <div className="rounded-2xl border border-[--border] bg-[--surface] p-4 sm:p-5 space-y-4" style={{ boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[--ink]">Nuovo evento manuale</h3>
        <button
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded text-[--muted] hover:text-[--ink] hover:bg-[--surface-2] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
          aria-label="Chiudi"
        >
          <X className="size-4" />
        </button>
      </div>

      <form action={action} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Data" htmlFor="ev-date">
            <Input id="ev-date" name="date" type="date" defaultValue={defaultDate} required />
          </Field>
          <Field label="Importo €" htmlFor="ev-amount" hint="facoltativo">
            <Input id="ev-amount" name="amount" type="number" min="0" step="0.01" placeholder="0,00" />
          </Field>
        </div>

        <Field label="Descrizione" htmlFor="ev-label">
          <Input
            id="ev-label" name="label" list="ev-label-suggestions" required
            autoComplete="off" placeholder="es. Saldo IRPEF"
          />
          <datalist id="ev-label-suggestions">
            {LABEL_SUGGESTIONS.map(s => <option key={s} value={s} />)}
          </datalist>
        </Field>

        <Field label="Note" htmlFor="ev-note" hint="facoltativo">
          <Input id="ev-note" name="note" placeholder="Informazioni aggiuntive…" />
        </Field>

        {state?.error && <p className="text-xs text-[--danger]">{state.error}</p>}

        <div className="flex items-center gap-2 justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Annulla</Button>
          <Button type="submit" size="sm" loading={pending}>Aggiungi evento</Button>
        </div>
      </form>
    </div>
  )
}
