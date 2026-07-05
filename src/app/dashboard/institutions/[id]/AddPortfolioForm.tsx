'use client'
import { useActionState, useState } from 'react'
import { Plus } from 'lucide-react'
import { addPortfolio, type ActionState } from './actions'
import { Button, Field, Input, Select } from '@/components/ui'

export default function AddPortfolioForm({ institutionId }: { institutionId: number }) {
  const boundAction = addPortfolio.bind(null, institutionId)
  const [state, action, pending] = useActionState<ActionState, FormData>(boundAction, undefined)
  const [mode, setMode] = useState<'transactions' | 'holdings'>('transactions')

  return (
    <form action={action} className="flex flex-col sm:flex-row gap-2 sm:items-end flex-wrap">
      <Field label="Tipo portafoglio" htmlFor="pf-mode" className="w-44 shrink-0">
        <Select
          id="pf-mode"
          name="mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as 'transactions' | 'holdings')}
        >
          <option value="transactions">Investimenti (ETF/Azioni)</option>
          <option value="holdings">Crypto (posizioni)</option>
        </Select>
      </Field>
      <Field label="Nome portafoglio" htmlFor="pf-name" className="flex-1 min-w-40">
        <Input
          id="pf-name"
          name="name"
          required
          placeholder={mode === 'holdings' ? 'es. Crypto.com' : 'es. ETF Accumulo'}
        />
      </Field>
      {mode === 'transactions' && (
        <Field label="Valuta" htmlFor="pf-currency" className="w-28">
          <Input
            id="pf-currency"
            name="currency"
            defaultValue="EUR"
            maxLength={3}
            required
            className="uppercase"
          />
        </Field>
      )}
      {/* I portafogli crypto usano sempre EUR (CoinGecko restituisce in EUR) */}
      {mode === 'holdings' && (
        <input type="hidden" name="currency" value="EUR" />
      )}
      <Button type="submit" variant="secondary" loading={pending} className="shrink-0 self-end">
        <Plus className="size-4" />
        Portafoglio
      </Button>
      {state?.error && (
        <p className="text-sm text-[--danger] w-full">{state.error}</p>
      )}
    </form>
  )
}
