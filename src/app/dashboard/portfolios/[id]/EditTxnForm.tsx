'use client'
import { useState, useTransition } from 'react'
import { updateTxnAction } from './actions'
import { Button, Field, Input, Select } from '@/components/ui'
import type { InvestmentTxn } from '@/db/schema'

interface Props {
  txn:        InvestmentTxn
  portfolioId: number
  onCancel:   () => void
  onSaved:    () => void
}

function minorToDecimal(minor: number): string {
  return (minor / 100).toFixed(2)
}

export default function EditTxnForm({ txn, portfolioId, onCancel, onSaved }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError]            = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setError(null)
    startTransition(async () => {
      const result = await updateTxnAction(portfolioId, txn.id, undefined, formData)
      if (result?.error) setError(result.error)
      else onSaved()
    })
  }

  const isBuySell   = txn.type === 'buy'      || txn.type === 'sell'
  const isDividFee  = txn.type === 'dividend' || txn.type === 'fee'

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end p-3 bg-[--surface-2] rounded-xl">
      <input type="hidden" name="currency" value={txn.currency} />

      <Field label="Tipo" htmlFor={`et-type-${txn.id}`} className="w-32">
        <Select id={`et-type-${txn.id}`} name="type" defaultValue={txn.type}>
          <option value="buy">Acquisto</option>
          <option value="sell">Vendita</option>
          <option value="dividend">Dividendo</option>
          <option value="fee">Commissione</option>
        </Select>
      </Field>

      <Field label="Data" htmlFor={`et-date-${txn.id}`} className="w-36">
        <Input
          id={`et-date-${txn.id}`}
          name="trade_date"
          type="date"
          required
          defaultValue={txn.trade_date}
        />
      </Field>

      {(isBuySell || txn.quantity) && (
        <Field label="Quantità" htmlFor={`et-qty-${txn.id}`} className="w-28">
          <Input
            id={`et-qty-${txn.id}`}
            name="quantity"
            type="number"
            step="any"
            defaultValue={txn.quantity ?? ''}
            placeholder="0"
          />
        </Field>
      )}

      {(isBuySell || txn.unit_price) && (
        <Field label={`Prezzo (${txn.currency})`} htmlFor={`et-price-${txn.id}`} className="w-28">
          <Input
            id={`et-price-${txn.id}`}
            name="unit_price"
            type="number"
            step="any"
            defaultValue={txn.unit_price ?? ''}
            placeholder="0.00"
          />
        </Field>
      )}

      {(isDividFee || txn.amount_minor !== null) && (
        <Field label={`Importo (${txn.currency})`} htmlFor={`et-amount-${txn.id}`} className="w-28">
          <Input
            id={`et-amount-${txn.id}`}
            name="amount"
            type="number"
            step="any"
            defaultValue={txn.amount_minor !== null ? minorToDecimal(txn.amount_minor) : ''}
            placeholder="0.00"
          />
        </Field>
      )}

      <Field label={`Comm. (${txn.currency})`} htmlFor={`et-fee-${txn.id}`} className="w-24">
        <Input
          id={`et-fee-${txn.id}`}
          name="fee"
          type="number"
          step="any"
          defaultValue={txn.fee_minor > 0 ? minorToDecimal(txn.fee_minor) : ''}
          placeholder="0.00"
        />
      </Field>

      <Field label="Note" htmlFor={`et-note-${txn.id}`} className="w-40">
        <Input
          id={`et-note-${txn.id}`}
          name="note"
          type="text"
          defaultValue={txn.note ?? ''}
          placeholder="opzionale"
        />
      </Field>

      <div className="flex gap-2 self-end">
        <Button type="submit" size="sm" loading={isPending}>Salva</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Annulla</Button>
      </div>

      {error && <p className="w-full text-xs text-[--danger]">{error}</p>}
    </form>
  )
}
