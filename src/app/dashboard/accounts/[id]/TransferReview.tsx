'use client'
// Revisione dei giroconti del conto: coppie proposte da confermare o scartare
// e giroconti già confermati, annullabili.
import { useState, useTransition } from 'react'
import { ArrowRight, Check, X, Undo2, ArrowLeftRight } from 'lucide-react'
import { Button, EmptyState } from '@/components/ui'
import { formatMoney } from '@/lib/money'
import type { ConfirmedTransfer, TransferLeg, TransferSuggestion } from '@/lib/transfers'
import { confirmTransferAction, rejectTransferAction, undoTransferAction } from './transfer-actions'

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function Legs({ outflow, inflow, categoryNames }: { outflow: TransferLeg; inflow: TransferLeg; categoryNames?: Record<number, string> }) {
  const cat = (leg: TransferLeg) => (leg.category_id !== null ? categoryNames?.[leg.category_id] : null) ?? 'senza categoria'
  return (
    <div className="min-w-0 space-y-1">
      <p className="flex items-center gap-1.5 flex-wrap text-sm text-(--ink)">
        <span className="font-medium">{outflow.account_name}</span>
        <ArrowRight className="size-3.5 text-(--muted)" aria-label="verso" />
        <span className="font-medium">{inflow.account_name}</span>
        <span className="font-mono tabular-nums ml-1">{formatMoney(inflow.amount_minor, inflow.currency)}</span>
      </p>
      <p className="text-xs text-(--muted) tabular-nums">
        Uscita {formatDate(outflow.booked_date)} · {outflow.description_raw}
        {categoryNames && <> · <span className="text-(--ink)">{cat(outflow)}</span></>}
      </p>
      <p className="text-xs text-(--muted) tabular-nums">
        Entrata {formatDate(inflow.booked_date)} · {inflow.description_raw}
        {categoryNames && <> · <span className="text-(--ink)">{cat(inflow)}</span></>}
      </p>
    </div>
  )
}

export default function TransferReview({ suggestions, confirmed, categoryNames }: {
  suggestions:   TransferSuggestion[]
  confirmed:     ConfirmedTransfer[]
  categoryNames: Record<number, string>
}) {
  const [pending, start] = useTransition()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function run(key: string, action: () => Promise<{ error?: string }>) {
    setBusyKey(key); setMessage(null)
    start(async () => {
      const result = await action().catch(() => ({ error: 'Operazione non riuscita. Riprova.' }))
      if (result.error) setMessage(result.error)
      setBusyKey(null)
    })
  }

  if (suggestions.length === 0 && confirmed.length === 0) {
    return <EmptyState icon={ArrowLeftRight} title="Nessun giroconto da rivedere"
      description="Qui compaiono le coppie di movimenti speculari tra i tuoi conti: stesso importo e valuta, segni opposti, entro 3 giorni." />
  }

  return (
    <div className="space-y-6">
      {message && <p role="status" className="text-sm text-(--danger-text)">{message}</p>}
      {suggestions.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-(--ink)">Da confermare</h3>
          <ul className="space-y-2">
            {suggestions.map((s) => {
              const key = `${s.outflow.id}:${s.inflow.id}`
              return (
                <li key={key} className="rounded-xl border border-(--border) bg-(--surface) p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                  <Legs outflow={s.outflow} inflow={s.inflow} categoryNames={categoryNames} />
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" disabled={pending} loading={busyKey === key + ':ok'}
                      onClick={() => run(key + ':ok', () => confirmTransferAction(s.outflow.id, s.inflow.id))}>
                      <Check className="size-3.5" aria-hidden /> Conferma giroconto
                    </Button>
                    <Button size="sm" variant="ghost" disabled={pending} loading={busyKey === key + ':no'}
                      onClick={() => run(key + ':no', () => rejectTransferAction(s.outflow.id, s.inflow.id))}>
                      <X className="size-3.5" aria-hidden /> Non è un giroconto
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {confirmed.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-(--ink)">Confermati</h3>
          <ul className="space-y-2">
            {confirmed.map((c) => (
              <li key={c.linkId} className="rounded-xl border border-(--border) p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                <Legs outflow={c.outflow} inflow={c.inflow} />
                <Button size="sm" variant="ghost" disabled={pending} loading={busyKey === `undo:${c.linkId}`}
                  onClick={() => run(`undo:${c.linkId}`, () => undoTransferAction(c.linkId))}>
                  <Undo2 className="size-3.5" aria-hidden /> Annulla
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
