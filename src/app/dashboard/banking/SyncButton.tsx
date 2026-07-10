'use client'
// src/app/dashboard/banking/SyncButton.tsx — Sync manuale di una connessione
// Open Banking già attiva, o riconnessione se la sessione è scaduta.
import { useState, useTransition } from 'react'
import { syncConnectionAction, disconnectAction, startConnectAction } from './actions'
import { Button, Badge } from '@/components/ui'
import { RefreshCw, Unlink } from 'lucide-react'
import type { AspspOption } from './ConnectBankButton'

type Result = { insertedCount: number; duplicateCount: number; error?: string } | null

export default function SyncButton({
  institutionId,
  connectionId,
  status,
  aspsp,
  lastSyncedAt,
}: {
  institutionId: number
  connectionId:  number
  status:        'active' | 'expired' | 'revoked' | 'pending'
  aspsp:         AspspOption
  lastSyncedAt:  string | null   // già formattata dal server, o null
}) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<Result>(null)

  function handleSync() {
    setResult(null)
    startTransition(async () => {
      const r = await syncConnectionAction(connectionId)
      setResult(r)
    })
  }

  function handleReconnect() {
    setResult(null)
    startTransition(async () => {
      const r = await startConnectAction(institutionId, aspsp.name, aspsp.country)
      if (r?.error) setResult({ insertedCount: 0, duplicateCount: 0, error: r.error })
    })
  }

  function handleDisconnect() {
    startTransition(async () => {
      await disconnectAction(connectionId)
    })
  }

  if (status === 'revoked') return null

  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-t border-[--border] first:border-t-0">
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <span className="text-sm text-[--ink]">{aspsp.name}</span>
        <Badge variant={status === 'active' ? 'success' : 'warning'}>
          {status === 'active' ? 'Collegata' : status === 'expired' ? 'Scaduta' : 'In attesa'}
        </Badge>
        {lastSyncedAt && (
          <span className="text-xs text-[--faint]">ultima sync {lastSyncedAt}</span>
        )}
      </div>

      {status === 'expired' ? (
        <Button size="sm" variant="secondary" onClick={handleReconnect} loading={isPending}>
          <RefreshCw className="size-3.5" />
          Riconnetti
        </Button>
      ) : (
        <Button size="sm" variant="secondary" onClick={handleSync} loading={isPending} disabled={status !== 'active'}>
          <RefreshCw className="size-3.5" />
          Sincronizza
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={handleDisconnect} disabled={isPending}>
        <Unlink className="size-3.5" />
        Scollega
      </Button>

      {result?.error && (
        <p className="w-full text-xs text-[--danger]">{result.error}</p>
      )}
      {result && !result.error && (
        <p className="w-full text-xs text-[--muted]">
          {result.insertedCount} movimenti inseriti · {result.duplicateCount} duplicati ignorati
        </p>
      )}
    </div>
  )
}
