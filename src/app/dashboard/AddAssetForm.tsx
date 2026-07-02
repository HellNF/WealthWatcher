'use client'
import { useActionState } from 'react'
import { Plus } from 'lucide-react'
import { Button, Field, Input, Select } from '@/components/ui'
import { addAssetAction } from './assets-actions'
import { ASSET_KINDS } from './assetKinds'

type State = { error?: string } | undefined

export default function AddAssetForm() {
  const [state, action, pending] = useActionState<State, FormData>(addAssetAction, undefined)

  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
      <Field label="Nome" htmlFor="asset-name" className="flex-1 min-w-40">
        <Input id="asset-name" name="name" required placeholder="es. Contanti, Casa, Auto" maxLength={100} />
      </Field>
      <Field label="Tipo" htmlFor="asset-kind">
        <Select id="asset-kind" name="kind" defaultValue="cash">
          {ASSET_KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </Select>
      </Field>
      <Field label="Valore" htmlFor="asset-value">
        <Input id="asset-value" name="value" type="number" step="0.01" required placeholder="0.00" className="max-w-32" />
      </Field>
      <Field label="Valuta" htmlFor="asset-currency">
        <Input id="asset-currency" name="currency" defaultValue="EUR" maxLength={3} className="max-w-20 uppercase" />
      </Field>
      <Button type="submit" loading={pending} className="shrink-0 self-end">
        <Plus className="size-4" />
        Aggiungi
      </Button>
      {state?.error && <p className="text-sm text-[--danger] self-center">{state.error}</p>}
    </form>
  )
}
