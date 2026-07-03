'use client'

import { useState, useTransition } from 'react'
import { Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { backfillHistoryAction } from './actions'
import type { BackfillResult } from '@/lib/prices/backfill'

interface Props {
  portfolioId: number
}

export default function PriceHistoryBackfillButton({ portfolioId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [results, setResults] = useState<BackfillResult[] | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(null)

  function handleClick() {
    setResults(null)
    setGlobalError(null)
    startTransition(async () => {
      const res = await backfillHistoryAction(portfolioId)
      if ('error' in res) {
        setGlobalError(res.error)
      } else {
        setResults(res.results)
      }
    })
  }

  const totalInserted = results?.reduce((s, r) => s + r.inserted, 0) ?? 0

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="space-y-1">
          <p className="text-sm font-medium text-[--ink]">Storico prezzi</p>
          <p className="text-xs text-[--muted]">
            Scarica i prezzi giornalieri storici da Yahoo Finance per tutti gli strumenti
            del portafoglio, a partire dalla prima operazione registrata. Necessario per
            il calcolo del DCA Counterfactual nelle statistiche.
          </p>
        </div>
        <button
          onClick={handleClick}
          disabled={isPending}
          className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-[--border] bg-[--surface-1] px-3 py-2 text-sm font-medium text-[--ink] hover:bg-[--surface-2] disabled:opacity-50 transition-colors"
        >
          {isPending
            ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
            : <Download className="size-4" strokeWidth={1.75} />}
          {isPending ? 'Download in corso…' : 'Scarica storico'}
        </button>
      </div>

      {globalError && (
        <div className="flex items-center gap-2 text-sm text-[--danger]">
          <AlertCircle className="size-4 shrink-0" strokeWidth={1.75} />
          {globalError}
        </div>
      )}

      {results && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-[--brand-text]">
            <CheckCircle className="size-4 shrink-0" strokeWidth={1.75} />
            {totalInserted > 0
              ? `${totalInserted} prezzi storici inseriti`
              : 'Storico già completo — nessun nuovo dato da inserire'}
          </div>
          <div className="pl-6 space-y-0.5">
            {results.map((r, i) => (
              <p key={i} className="text-xs text-[--muted]">
                <span className="font-mono">{r.symbol}</span>
                {r.error
                  ? <span className="text-[--danger]"> — {r.error}</span>
                  : <span> — {r.inserted} righe inserite</span>}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
