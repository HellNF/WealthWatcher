'use client'
import { useState, useActionState, useEffect, useRef } from 'react'
import { Pencil, X } from 'lucide-react'
import { Button, Field, Input, Select, ConfirmDelete } from '@/components/ui'
import { updateAssetAction, deleteAssetAction } from './assets-actions'
import { ASSET_KINDS, KIND_MAP } from './assetKinds'
import { fromMinor } from '@/lib/money'
import type { Asset } from '@/lib/assets'

type State = { error?: string } | undefined

export default function AssetRow({ asset }: { asset: Asset }) {
  const [editing, setEditing] = useState(false)
  const [state, action, pending] = useActionState<State, FormData>(
    updateAssetAction.bind(null, asset.id),
    undefined,
  )
  const wasPending = useRef(false)
  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) setEditing(false)
    wasPending.current = pending
  }, [pending, state])

  const kind = KIND_MAP[asset.kind] ?? KIND_MAP.other
  const Icon = kind.Icon

  if (editing) {
    return (
      <div className="px-5 py-4 space-y-1">
        <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
          <Field label="Nome" htmlFor={`a-name-${asset.id}`} className="flex-1 min-w-40">
            <Input id={`a-name-${asset.id}`} name="name" defaultValue={asset.name} required autoFocus maxLength={100} />
          </Field>
          <Field label="Tipo" htmlFor={`a-kind-${asset.id}`}>
            <Select id={`a-kind-${asset.id}`} name="kind" defaultValue={asset.kind}>
              {ASSET_KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Valore" htmlFor={`a-val-${asset.id}`}>
            <Input
              id={`a-val-${asset.id}`}
              name="value"
              type="number"
              step="0.01"
              defaultValue={(asset.value_minor / 100).toFixed(2)}
              required
              className="max-w-32"
            />
          </Field>
          <Field label="Valuta" htmlFor={`a-cur-${asset.id}`}>
            <Input id={`a-cur-${asset.id}`} name="currency" defaultValue={asset.currency} maxLength={3} className="max-w-20 uppercase" />
          </Field>
          <div className="flex gap-2 shrink-0">
            <Button type="submit" loading={pending}>Salva</Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)} aria-label="Annulla">
              <X className="size-4" />
            </Button>
          </div>
        </form>
        {state?.error && <p className="text-xs text-[--danger]">{state.error}</p>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="size-10 rounded-xl bg-[--surface-2] flex items-center justify-center shrink-0">
        <Icon className="size-5 text-[--muted]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[--ink] truncate">{asset.name}</p>
        <p className="text-xs text-[--muted]">{kind.label}</p>
      </div>
      <span className="font-mono tabular-nums text-sm font-medium text-[--ink] shrink-0">
        {fromMinor(asset.value_minor, asset.currency)}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label="Modifica">
          <Pencil className="size-3.5" />
        </Button>
        <ConfirmDelete
          action={deleteAssetAction.bind(null, asset.id)}
          label=""
          confirmText="Eliminare questo bene?"
        />
      </div>
    </div>
  )
}
