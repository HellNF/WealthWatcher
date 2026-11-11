'use client'
// src/app/dashboard/accounts/[id]/AccountSyncButton.tsx — Sync Open Banking
// scoperto dalla pagina del singolo conto, non solo da quella dell'istituzione:
// l'azione più naturale quando si vuole aggiornare i movimenti di *questo*
// conto. Sincronizza comunque l'intera connessione (una sessione Enable
// Banking può coprire più conti), ma il risultato mostrato riguarda solo
// l'importo di questo conto.
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { syncConnectionAction, type SyncActionResult } from '@/app/dashboard/banking/actions'
import { Button } from '@/components/ui'
import { RefreshCw } from 'lucide-react'
import type { SyncRunSummary } from '@/lib/banking/syncRuns'

export default function AccountSyncButton({ connectionId, accountId, lastRun }: { connectionId: number; accountId: number; lastRun?: SyncRunSummary | null }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<SyncActionResult | null>(null)

  function handleSync() {
    setResult(null)
    startTransition(async () => {
      const r = await syncConnectionAction(connectionId)
      // Questo conto era un doppione nato dal rinnovo del consenso ed è stato
      // riunito al conto originale: la sua pagina non esiste più.
      const target = r.mergedInto?.find((m) => m.from === accountId)
      if (target) {
        router.replace(`/dashboard/accounts/${target.to}`)
        return
      }
      setResult(r)
    })
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Button
        type="button"
        variant="secondary"
        onClick={handleSync}
        loading={isPending}
        className="h-9"
      >
        <RefreshCw className="size-4" />
        Sincronizza (Open Banking)
      </Button>
      {!result && lastRun && (
        <span className={`text-xs ${lastRun.outcome === 'ok' ? 'text-(--muted)' : 'text-(--warning-text)'}`}
          title={lastRun.outcome !== 'ok' ? lastRun.error ?? undefined : undefined}>
          Ultima sync {lastRun.when} · {lastRun.label}
        </span>
      )}
      {result?.error && <span className="text-sm text-(--danger)">{result.error}</span>}
      {result && !result.error && (
        <span className="text-sm text-(--muted)">
          {result.insertedCount} nuovi movimenti · {result.duplicateCount} già presenti
          {result.categorized !== undefined && ` · ${result.categorized} categorizzati automaticamente`}
        </span>
      )}
    </div>
  )
}
