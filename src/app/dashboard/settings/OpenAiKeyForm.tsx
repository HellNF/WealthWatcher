'use client'

import { useActionState } from 'react'
import { saveOpenAiKeyAction, removeOpenAiKeyAction } from './actions'
import { Button, Input } from '@/components/ui'
import { formatDateIt } from '@/lib/formatDate'

type Props = { hasKey: boolean; setAt: number | null }
type State = { error?: string; success?: string } | undefined

export default function OpenAiKeyForm({ hasKey, setAt }: Props) {
  const [saveState, saveAction, savePending] = useActionState<State, FormData>(saveOpenAiKeyAction, undefined)
  const [removeState, removeAction, removePending] = useActionState<State, FormData>(removeOpenAiKeyAction, undefined)

  const setAtLabel = setAt
    ? formatDateIt(setAt, { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="space-y-4">
      {/* Stato chiave */}
      <div className="flex items-center gap-2 text-sm">
        <span
          className={[
            'size-2 rounded-full shrink-0',
            hasKey ? 'bg-[--brand]' : 'bg-[--faint]',
          ].join(' ')}
        />
        <span className="text-[--muted]">
          {hasKey
            ? `Chiave impostata${setAtLabel ? ` il ${setAtLabel}` : ''}`
            : 'Nessuna chiave impostata'}
        </span>
      </div>

      {/* Form salvataggio */}
      <form action={saveAction} className="flex gap-2">
        <Input
          type="password"
          name="openai_key"
          placeholder={hasKey ? 'Sostituisci chiave (sk-…)' : 'Inserisci chiave (sk-…)'}
          autoComplete="off"
          required
          className="flex-1"
        />
        <Button type="submit" disabled={savePending} loading={savePending}>
          Salva
        </Button>
      </form>

      {saveState?.error   && <p className="text-xs text-[--danger]" role="alert">{saveState.error}</p>}
      {saveState?.success && <p className="text-xs text-[--brand]">{saveState.success}</p>}

      {/* Rimozione */}
      {hasKey && (
        <form action={removeAction}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={removePending}
            loading={removePending}
          >
            Rimuovi chiave
          </Button>
          {removeState?.error   && <p className="text-xs text-[--danger] mt-1" role="alert">{removeState.error}</p>}
          {removeState?.success && <p className="text-xs text-[--brand] mt-1">{removeState.success}</p>}
        </form>
      )}

      <p className="text-xs text-[--faint] leading-relaxed max-w-prose">
        La chiave è cifrata (AES-256-GCM) nel database e viene usata esclusivamente per
        estrarre i dati dai PDF KID che carichi. Non viene mai inviata ad altri servizi.
        Ogni utente usa (e paga) la propria quota OpenAI.
      </p>
    </div>
  )
}
