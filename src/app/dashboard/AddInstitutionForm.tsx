'use client'
import { useState } from 'react'
import { useActionState } from 'react'
import { Plus, Info } from 'lucide-react'
import { addInstitution, type ActionState } from './actions'
import { Button, Field, Input, Select } from '@/components/ui'
import { PROVIDERS } from '@/lib/providers'

const CUSTOM = '__custom__'

export default function AddInstitutionForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addInstitution,
    undefined,
  )
  const [choice, setChoice] = useState(PROVIDERS[0].id)
  const isCustom = choice === CUSTOM
  const selected = PROVIDERS.find((p) => p.id === choice)

  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label="Banca" htmlFor="inst-provider" className="flex-1">
          {/* Il valore inviato: id provider, oppure '' se personalizzata */}
          <Select
            id="inst-provider"
            name="provider"
            value={isCustom ? '' : choice}
            onChange={(e) => setChoice(e.target.value === '' ? CUSTOM : e.target.value)}
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.parser ? ' — import supportato' : ''}
              </option>
            ))}
            <option value="">Altra banca (personalizzata)…</option>
          </Select>
        </Field>

        {isCustom && (
          <>
            <Field label="Nome" htmlFor="inst-name" className="flex-1">
              <Input id="inst-name" name="name" required placeholder="es. La mia banca" maxLength={100} />
            </Field>
            <Field label="Tipo" htmlFor="inst-kind">
              <Select id="inst-kind" name="kind" defaultValue="bank">
                <option value="bank">Banca</option>
                <option value="broker">Broker</option>
                <option value="both">Banca · Broker</option>
              </Select>
            </Field>
            <Field label="Paese (opt.)" htmlFor="inst-country">
              <Input
                id="inst-country"
                name="country"
                placeholder="es. IE"
                maxLength={2}
                className="w-20 uppercase"
                title="Codice ISO 2 lettere. Lascia vuoto per intermediari italiani."
              />
            </Field>
          </>
        )}

        <Button type="submit" loading={pending} className="shrink-0 self-end">
          <Plus className="size-4" />
          Aggiungi
        </Button>
      </div>

      {isCustom ? (
        <p className="flex items-start gap-1.5 text-xs text-[--warning-text]">
          <Info className="size-3.5 shrink-0 mt-0.5" />
          Per le banche personalizzate l&apos;import automatico dell&apos;estratto conto non è
          supportato: potrai comunque inserire i movimenti manualmente.
        </p>
      ) : selected && !selected.parser ? (
        <p className="flex items-start gap-1.5 text-xs text-[--muted]">
          <Info className="size-3.5 shrink-0 mt-0.5" />
          Import estratto conto non ancora disponibile per {selected.name}; puoi comunque tracciarne
          conti e saldi.
        </p>
      ) : null}

      {state?.error && <p className="text-sm text-[--danger]">{state.error}</p>}
    </form>
  )
}
