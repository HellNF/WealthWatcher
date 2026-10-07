'use client'
// src/app/dashboard/mercati/RefreshMarketsButton.tsx — Aggiorna su richiesta i
// dati di mercato (di norma li aggiorna il job notturno). L'operazione dura
// circa un minuto: il pulsante lo dice e mostra l'esito, anche parziale.
import { useState, useTransition } from 'react'
import { RefreshCw } from 'lucide-react'
import { refreshMarketsAction, type RefreshState } from './actions'

export default function RefreshMarketsButton() {
  const [isPending, startTransition] = useTransition()
  const [state, setState] = useState<RefreshState | null>(null)

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(async () => setState(await refreshMarketsAction()))}
        className="inline-flex items-center gap-1.5 rounded-lg border border-(--border) bg-(--surface) px-3 py-1.5 text-xs font-medium text-(--ink) hover:bg-(--surface-2) active:scale-[0.98] disabled:opacity-60 transition-all duration-150"
      >
        <RefreshCw className={`size-3.5 ${isPending ? 'animate-spin' : ''}`} strokeWidth={1.75} aria-hidden />
        {isPending ? 'Aggiornamento in corso (circa un minuto)…' : 'Aggiorna i dati'}
      </button>
      {state && !isPending && (
        <span role="status" className={`text-xs ${state.ok ? 'text-(--brand-text)' : 'text-(--warning-text)'}`}>
          {state.message}
        </span>
      )}
    </div>
  )
}
