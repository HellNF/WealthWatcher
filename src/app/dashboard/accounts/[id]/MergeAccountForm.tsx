'use client'
import { useState, useActionState } from 'react'
import { Merge, X } from 'lucide-react'
import { Button, Field, Select } from '@/components/ui'
import { mergeAccountAction } from './manage-actions'

type State = { error?: string; success?: string } | undefined

export interface MergeCandidate {
  id:         number
  name:       string
  txnCount:   number
  firstDate:  string | null
  lastDate:   string | null
}

interface Props {
  accountId:  number
  candidates: MergeCandidate[]
}

const MONTHS_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const monthLabel = (iso: string) => `${MONTHS_IT[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`

function describe(c: MergeCandidate): string {
  if (c.txnCount === 0 || !c.firstDate || !c.lastDate) return `${c.name} · nessun movimento`
  return `${c.name} · ${c.txnCount.toLocaleString('it-IT')} movimenti, ${monthLabel(c.firstDate)} – ${monthLabel(c.lastDate)}`
}

/**
 * Unisce un doppione in questo conto. Due passi come ConfirmDelete: si sceglie
 * il conto, poi si conferma, perché l'altro conto viene eliminato.
 */
export default function MergeAccountForm({ accountId, candidates }: Props) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<State, FormData>(
    mergeAccountAction.bind(null, accountId),
    undefined,
  )

  if (!open) {
    return (
      <div className="space-y-2">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Merge className="size-3.5" />
          Unisci con un altro conto
        </Button>
        {state?.success && <p className="text-xs text-(--muted)">{state.success}</p>}
      </div>
    )
  }

  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label="Conto da unire in questo" htmlFor="merge-absorb" className="flex-1 min-w-0">
          <Select id="merge-absorb" name="absorbId" required defaultValue={candidates[0]?.id}>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>{describe(c)}</option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-2 shrink-0">
          <Button type="submit" loading={pending}>Unisci</Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} aria-label="Annulla">
            <X className="size-4" />
          </Button>
        </div>
      </div>
      <p className="text-xs text-(--muted)">
        I movimenti dell&apos;altro conto vengono spostati qui (quelli già presenti non si duplicano) e
        l&apos;altro conto viene eliminato. Resta attivo il collegamento Open Banking più recente.
      </p>
      {state?.error && <p className="text-xs text-(--danger)">{state.error}</p>}
    </form>
  )
}
