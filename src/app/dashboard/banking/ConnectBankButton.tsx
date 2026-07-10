'use client'
// src/app/dashboard/banking/ConnectBankButton.tsx — Selezione ASPSP + avvio
// del consenso Open Banking. L'elenco banche è pre-caricato lato server
// (institutions/[id]/page.tsx) per evitare una seconda chiamata client→server
// solo per popolare la select.
import { useState, useTransition } from 'react'
import { startConnectAction } from './actions'
import { Button, Field, Select } from '@/components/ui'
import { Landmark } from 'lucide-react'

export interface AspspOption {
  name:    string
  country: string
}

export default function ConnectBankButton({
  institutionId,
  aspsps,
}: {
  institutionId: number
  aspsps:        AspspOption[]
}) {
  const [selected, setSelected] = useState(0)
  const [error, setError]       = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (aspsps.length === 0) return null

  function handleConnect() {
    setError(null)
    const chosen = aspsps[selected]
    startTransition(async () => {
      const result = await startConnectAction(institutionId, chosen.name, chosen.country)
      // Successo → startConnectAction ha già reindirizzato il browser verso la banca.
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
      <Field label="Collega banca (Open Banking)" htmlFor="eb-aspsp" className="flex-1">
        <Select
          id="eb-aspsp"
          value={selected}
          onChange={(e) => setSelected(Number(e.target.value))}
        >
          {aspsps.map((a, i) => (
            <option key={`${a.name}-${a.country}-${i}`} value={i}>
              {a.name} ({a.country})
            </option>
          ))}
        </Select>
      </Field>
      <Button
        type="button"
        variant="secondary"
        onClick={handleConnect}
        loading={isPending}
        className="shrink-0 self-end"
      >
        <Landmark className="size-4" />
        Collega
      </Button>
      {error && <p className="text-sm text-[--danger] sm:self-center">{error}</p>}
    </div>
  )
}
