'use client'
// src/app/dashboard/RefreshNetWorthButton.tsx — Ricalcola su richiesta lo
// snapshot di oggi del patrimonio netto. Utile perché lo snapshot viene
// altrimenti calcolato solo alla prima apertura della dashboard nel giorno
// (ensureTodaySnapshot) o dopo mutazioni specifiche (refreshNetWorth nelle
// altre server action) — qui l'utente forza il ricalcolo esplicitamente.
import { useTransition } from 'react'
import { refreshNetWorthAction } from './actions'
import { RefreshCw } from 'lucide-react'

export default function RefreshNetWorthButton() {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      onClick={() => startTransition(() => refreshNetWorthAction())}
      disabled={isPending}
      title="Ricalcola il patrimonio netto"
      aria-label="Ricalcola il patrimonio netto"
      className="inline-flex items-center justify-center size-4 rounded text-[--faint] hover:text-[--ink] active:scale-90 disabled:opacity-50 disabled:active:scale-100 transition-all duration-150 shrink-0"
    >
      <RefreshCw className={`size-3 ${isPending ? 'animate-spin' : ''}`} strokeWidth={1.75} />
    </button>
  )
}
