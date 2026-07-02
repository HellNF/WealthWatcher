'use client'
import { useState, useTransition, useActionState } from 'react'
import { Pencil, X } from 'lucide-react'
import { Button, Field, Input } from '@/components/ui'
import { setBalanceAction, clearBalanceAction } from './balance-actions'

type State = { error?: string; success?: string } | undefined

interface Props {
  accountId: number
  currency: string
  today: string
  /** Data del saldo di riferimento se impostato, altrimenti null */
  anchorDate: string | null
  /** Importo da precompilare nel campo (decimale, es. "1234.56") */
  prefillAmount: string
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function SetBalanceForm({
  accountId,
  currency,
  today,
  anchorDate,
  prefillAmount,
}: Props) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<State, FormData>(
    setBalanceAction.bind(null, accountId),
    undefined,
  )
  const [clearing, startClear] = useTransition()

  // Chiude il form dopo un salvataggio riuscito.
  if (state?.success && open) setOpen(false)

  if (!open) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="size-3.5" />
          {anchorDate ? 'Rettifica saldo' : 'Imposta saldo reale'}
        </Button>
        {anchorDate ? (
          <span className="text-xs text-[--muted]">
            Saldo di riferimento al {fmtDate(anchorDate)} · i movimenti successivi lo aggiornano
          </span>
        ) : (
          <span className="text-xs text-[--muted]">
            Il saldo è la somma dei movimenti importati. Imposta il saldo reale per allinearlo.
          </span>
        )}
        {anchorDate && (
          <button
            type="button"
            onClick={() => startClear(() => clearBalanceAction(accountId))}
            disabled={clearing}
            className="text-xs text-[--faint] hover:text-[--danger] transition-colors disabled:opacity-50"
          >
            Rimuovi
          </button>
        )}
      </div>
    )
  }

  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label={`Saldo reale (${currency})`} htmlFor="bal-amount" className="flex-1">
          <Input
            id="bal-amount"
            name="amount"
            type="number"
            step="0.01"
            required
            defaultValue={prefillAmount}
            placeholder="0.00"
          />
        </Field>
        <Field label="Alla data" htmlFor="bal-date">
          <Input id="bal-date" name="date" type="date" required defaultValue={anchorDate ?? today} max={today} />
        </Field>
        <div className="flex gap-2 shrink-0">
          <Button type="submit" loading={pending}>Salva</Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} aria-label="Annulla">
            <X className="size-4" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-[--muted]">
        Inserisci il totale che vedi in banca a quella data. Da lì in poi il saldo mostrato si
        aggiorna sommando i movimenti con data successiva.
      </p>
      {state?.error && <p className="text-xs text-[--danger]">{state.error}</p>}
    </form>
  )
}
