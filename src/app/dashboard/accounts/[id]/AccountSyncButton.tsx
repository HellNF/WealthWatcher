'use client'
// src/app/dashboard/accounts/[id]/AccountSyncButton.tsx — Sync Open Banking
// scoperto dalla pagina del singolo conto, non solo da quella dell'istituzione:
// l'azione più naturale quando si vuole aggiornare i movimenti di *questo*
// conto. Sincronizza comunque l'intera connessione (una sessione Enable
// Banking può coprire più conti), ma il risultato mostrato riguarda solo
// l'importo di questo conto.
import { useState, useTransition } from 'react'
import { syncConnectionAction } from '@/app/dashboard/banking/actions'
import { Button } from '@/components/ui'
import { RefreshCw } from 'lucide-react'

export default function AccountSyncButton({ connectionId }: { connectionId: number }) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ insertedCount: number; duplicateCount: number; error?: string } | null>(null)

  function handleSync() {
    setResult(null)
    startTransition(async () => {
      const r = await syncConnectionAction(connectionId)
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
      {result?.error && <span className="text-sm text-[--danger]">{result.error}</span>}
      {result && !result.error && (
        <span className="text-sm text-[--muted]">
          {result.insertedCount} nuovi movimenti · {result.duplicateCount} già presenti
        </span>
      )}
    </div>
  )
}
