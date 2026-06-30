'use client'

import { useActionState } from 'react'
import { saveOpenAiKeyAction, removeOpenAiKeyAction } from './actions'

type Props = { hasKey: boolean; setAt: number | null }

type State = { error?: string; success?: string } | undefined

export default function OpenAiKeyForm({ hasKey, setAt }: Props) {
  const [saveState, saveAction, savePending] = useActionState<State, FormData>(saveOpenAiKeyAction, undefined)
  const [removeState, removeAction, removePending] = useActionState<State, FormData>(removeOpenAiKeyAction, undefined)

  const setAtLabel = setAt
    ? new Date(setAt * 1000).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-center gap-2 text-sm">
        {hasKey ? (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span className="text-zinc-300">
              Chiave impostata{setAtLabel ? ` il ${setAtLabel}` : ''}
            </span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-zinc-600 inline-block" />
            <span className="text-zinc-500">Nessuna chiave impostata</span>
          </>
        )}
      </div>

      {/* Save form */}
      <form action={saveAction} className="flex gap-2">
        <input
          type="password"
          name="openai_key"
          placeholder={hasKey ? 'Sostituisci chiave (sk-…)' : 'Inserisci chiave (sk-…)'}
          autoComplete="off"
          required
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-100 px-3 py-2 text-sm placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          type="submit"
          disabled={savePending}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50 transition"
        >
          {savePending ? 'Salvataggio…' : 'Salva'}
        </button>
      </form>

      {saveState?.error  && <p className="text-sm text-red-400">{saveState.error}</p>}
      {saveState?.success && <p className="text-sm text-emerald-400">{saveState.success}</p>}

      {/* Remove */}
      {hasKey && (
        <form action={removeAction}>
          <button
            type="submit"
            disabled={removePending}
            className="text-sm text-zinc-500 hover:text-red-400 transition disabled:opacity-50"
          >
            {removePending ? 'Rimozione…' : 'Rimuovi chiave'}
          </button>
          {removeState?.error   && <p className="text-sm text-red-400 mt-1">{removeState.error}</p>}
          {removeState?.success && <p className="text-sm text-emerald-400 mt-1">{removeState.success}</p>}
        </form>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-zinc-500 leading-relaxed">
        La chiave è cifrata (AES-256-GCM) nel database e viene usata esclusivamente per
        estrarre i dati dai PDF KID che carichi. Non viene mai inviata ad altri servizi.
        Ogni utente usa (e paga) la propria quota OpenAI.
      </p>
    </div>
  )
}
