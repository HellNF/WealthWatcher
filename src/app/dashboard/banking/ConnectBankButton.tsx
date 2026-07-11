'use client'
// src/app/dashboard/banking/ConnectBankButton.tsx — Selezione ASPSP + avvio
// del consenso Open Banking. L'elenco banche è pre-caricato lato server
// (institutions/[id]/page.tsx) per evitare una seconda chiamata client→server
// solo per popolare la select. Un campo di ricerca filtra la lista in tempo
// reale prima della select: con centinaia di ASPSP disponibili per alcuni
// paesi, scorrere un'unica lunga dropdown era impraticabile.
import { useState, useTransition } from 'react'
import { startConnectAction } from './actions'
import { Button, Field, Input, Select } from '@/components/ui'
import { Landmark, Search } from 'lucide-react'

export interface AspspOption {
  name:    string
  country: string
}

function keyOf(a: AspspOption): string {
  return `${a.name}|${a.country}`
}

export default function ConnectBankButton({
  institutionId,
  aspsps,
}: {
  institutionId: number
  aspsps:        AspspOption[]
}) {
  const [query, setQuery]             = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [error, setError]             = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()

  if (aspsps.length === 0) return null

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = normalizedQuery
    ? aspsps.filter((a) =>
        a.name.toLowerCase().includes(normalizedQuery) ||
        a.country.toLowerCase().includes(normalizedQuery),
      )
    : aspsps

  // Se la selezione corrente non è (più) tra i risultati filtrati — inclusa
  // la primissima scelta mai fatta — ricadi sul primo risultato filtrato.
  // Evita un useEffect di sincronizzazione: il valore è sempre derivato.
  const effectiveKey = filtered.some((a) => keyOf(a) === selectedKey)
    ? (selectedKey as string)
    : (filtered[0] ? keyOf(filtered[0]) : '')

  function handleConnect() {
    setError(null)
    const chosen = filtered.find((a) => keyOf(a) === effectiveKey)
    if (!chosen) return
    startTransition(async () => {
      const result = await startConnectAction(institutionId, chosen.name, chosen.country)
      // Successo → startConnectAction ha già reindirizzato il browser verso la banca.
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="space-y-3">
      <Field label="Cerca la tua banca" htmlFor="eb-aspsp-search">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[--faint] pointer-events-none" />
          <Input
            id="eb-aspsp-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="es. Intesa, Revolut, BBVA…"
            className="pl-8"
          />
        </div>
      </Field>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <Field
          label="Collega banca (Open Banking)"
          htmlFor="eb-aspsp"
          hint={`${filtered.length} di ${aspsps.length} banche${normalizedQuery ? ` per "${query.trim()}"` : ''}`}
          className="flex-1"
        >
          <Select
            id="eb-aspsp"
            value={effectiveKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            disabled={filtered.length === 0}
          >
            {filtered.length === 0 ? (
              <option value="">Nessuna banca trovata</option>
            ) : (
              filtered.map((a) => (
                <option key={keyOf(a)} value={keyOf(a)}>
                  {a.name} ({a.country})
                </option>
              ))
            )}
          </Select>
        </Field>
        <Button
          type="button"
          variant="secondary"
          onClick={handleConnect}
          loading={isPending}
          disabled={filtered.length === 0}
          className="shrink-0 self-end"
        >
          <Landmark className="size-4" />
          Collega
        </Button>
      </div>

      {error && <p className="text-sm text-[--danger]">{error}</p>}
    </div>
  )
}
