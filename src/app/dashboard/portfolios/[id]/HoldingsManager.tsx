'use client'
import { useState, useTransition } from 'react'
import { Search, X, Pencil, Trash2, RefreshCw, Check } from 'lucide-react'
import {
  searchCryptoAction,
  upsertCryptoHoldingAction,
  removeCryptoHoldingAction,
  refreshPricesAction,
} from './actions'
import type { CoinSearchResult } from '@/lib/prices/coingecko'
import type { Position } from '@/lib/investments/fifo'
import { fromMinor } from '@/lib/money'
import {
  Button, Badge, EmptyState, Field, Input,
  TableWrapper, Table, TableHead, TableBody, Th, Tr, Td,
  Card, CardHeader, CardTitle,
} from '@/components/ui'
import { TrendingUp } from 'lucide-react'

// ── Ricerca coin ───────────────────────────────────────────────────────────────

function CoinSearchBox({ onSelect }: { onSelect: (coin: CoinSearchResult) => void }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<CoinSearchResult[]>([])
  const [empty, setEmpty]     = useState(false)
  const [isPending, start]    = useTransition()

  function handleSearch() {
    if (!query.trim()) return
    setEmpty(false)
    start(async () => {
      const hits = await searchCryptoAction(query)
      setResults(hits)
      setEmpty(hits.length === 0)
    })
  }

  function pick(coin: CoinSearchResult) {
    onSelect(coin)
    setQuery('')
    setResults([])
    setEmpty(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
          placeholder="es. Bitcoin, Cardano, MATIC…"
          className="flex-1"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={handleSearch}
          disabled={isPending || !query.trim()}
          loading={isPending}
        >
          <Search className="size-4" />
          Cerca
        </Button>
      </div>

      {empty && (
        <p className="text-xs text-[--warning]">Nessuna cripto trovata per &ldquo;{query}&rdquo;</p>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {results.map((coin) => (
            <button
              key={coin.id}
              type="button"
              onClick={() => pick(coin)}
              className="flex items-center gap-3 rounded-xl border border-[--border] bg-[--surface] px-3 py-2.5 text-left hover:border-[--brand] hover:bg-[--brand-subtle] transition-colors duration-100 group"
            >
              {coin.thumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coin.thumb} alt="" className="size-6 rounded-full shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-[--ink] truncate group-hover:text-[--brand] transition-colors">
                  {coin.name}
                </p>
                <p className="text-xs text-[--muted]">{coin.symbol}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Form di aggiunta / modifica ────────────────────────────────────────────────
// Chiama direttamente il server action (senza useActionState) per poter
// rilevare il successo e chiudere il form automaticamente.

function HoldingForm({
  portfolioId,
  coin,
  initialQty,
  initialAvgCost,
  onDone,
  onCancel,
}: {
  portfolioId:     number
  coin:            { id: string; symbol: string; name: string }
  initialQty?:     string
  initialAvgCost?: string
  onDone:          () => void
  onCancel:        () => void
}) {
  const [error, setError]      = useState<string | null>(null)
  const [isPending, start]     = useTransition()

  function handleSubmit(fd: FormData) {
    setError(null)
    start(async () => {
      const result = await upsertCryptoHoldingAction(portfolioId, undefined, fd)
      if (result?.error) {
        setError(result.error)
      } else {
        onDone()
      }
    })
  }

  return (
    <form action={handleSubmit} className="space-y-3 p-4 rounded-xl border border-[--border] bg-[--surface-2]">
      <input type="hidden" name="coin_id"     value={coin.id} />
      <input type="hidden" name="coin_symbol" value={coin.symbol} />
      <input type="hidden" name="coin_name"   value={coin.name} />

      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-[--ink] flex-1">{coin.name}</p>
        <p className="text-xs text-[--muted] font-mono">{coin.symbol}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantità posseduta" htmlFor="hf-qty">
          <Input
            id="hf-qty"
            name="quantity"
            required
            defaultValue={initialQty ?? ''}
            placeholder="es. 0.25"
            className="font-mono"
          />
        </Field>
        <Field label="Prezzo medio carico (opzionale)" htmlFor="hf-avg">
          <Input
            id="hf-avg"
            name="avg_cost"
            defaultValue={initialAvgCost ?? ''}
            placeholder="es. 42000"
            className="font-mono"
          />
        </Field>
      </div>

      <p className="text-xs text-[--faint]">
        Il prezzo medio è opzionale. Se non indicato il P/L parte da oggi.
      </p>

      <div className="flex items-center gap-2">
        <Button type="submit" loading={isPending}>
          <Check className="size-4" />
          Salva
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annulla
        </Button>
        {error && <p className="text-xs text-[--danger]">{error}</p>}
      </div>
    </form>
  )
}

// ── Componente principale ──────────────────────────────────────────────────────

function fmtDate(epoch: number | null): string {
  if (!epoch) return '—'
  return new Date(epoch * 1000).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export default function HoldingsManager({
  positions,
  portfolioId,
}: {
  positions:   Position[]
  portfolioId: number
}) {
  const [addingNew, setAddingNew]       = useState(false)
  const [selectedCoin, setSelectedCoin] = useState<CoinSearchResult | null>(null)
  const [editingId, setEditingId]       = useState<number | null>(null)
  const [removePending, startRemove]    = useTransition()
  const [refreshPending, startRefresh]  = useTransition()

  const active = positions.filter((p) => parseFloat(p.remainingQty) > 0)

  function handleRemove(instrumentId: number) {
    startRemove(async () => {
      await removeCryptoHoldingAction(portfolioId, instrumentId)
    })
  }

  function handleRefresh() {
    startRefresh(async () => {
      await refreshPricesAction(portfolioId)
    })
  }

  function posAvgCost(pos: Position): string {
    const qty = parseFloat(pos.remainingQty)
    if (!pos.costBasisMinor || !qty) return ''
    const val = pos.costBasisMinor / Math.max(qty, 0.00000001) / 100
    return val > 0 ? val.toFixed(2) : ''
  }

  return (
    <div className="space-y-6">

      {/* ── Tabella posizioni ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[--ink]">Posizioni crypto</h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshPending}
            loading={refreshPending}
          >
            <RefreshCw className="size-3.5" />
            Aggiorna prezzi
          </Button>
        </div>

        {active.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="Nessuna cripto aggiunta"
            description="Cerca una criptovaluta qui sotto e inserisci la quantità posseduta."
          />
        ) : (
          <div className="space-y-3">
            {/* Form di modifica inline */}
            {editingId !== null && (() => {
              const pos = active.find((p) => p.instrumentId === editingId)
              if (!pos) return null
              return (
                <HoldingForm
                  portfolioId={portfolioId}
                  coin={{ id: pos.symbol.toLowerCase(), symbol: pos.symbol, name: pos.name }}
                  initialQty={pos.remainingQty}
                  initialAvgCost={posAvgCost(pos)}
                  onDone={() => setEditingId(null)}
                  onCancel={() => setEditingId(null)}
                />
              )
            })()}

            <TableWrapper className="rounded-xl border border-[--border] overflow-hidden">
              <Table>
                <TableHead>
                  <Tr>
                    <Th>Cripto</Th>
                    <Th className="text-right">Quantità</Th>
                    <Th className="text-right">P.M. carico</Th>
                    <Th className="text-right">Prezzo att.</Th>
                    <Th className="text-right">Valore EUR</Th>
                    <Th className="text-right">P/L</Th>
                    <Th className="text-right"></Th>
                  </Tr>
                </TableHead>
                <TableBody>
                  {active.map((pos) => {
                    const avgCost = pos.costBasisMinor /
                      Math.max(parseFloat(pos.remainingQty), 0.00000001) / 100
                    const pl = pos.unrealizedPlMinor
                    return (
                      <Tr key={pos.instrumentId}>
                        <Td>
                          <p className="font-medium text-[--ink]">{pos.name}</p>
                          <p className="text-xs text-[--muted]">{pos.symbol}</p>
                        </Td>
                        <Td numeric>
                          {parseFloat(pos.remainingQty).toLocaleString('it-IT', {
                            maximumFractionDigits: 8,
                          })}
                        </Td>
                        <Td numeric>
                          <span className="text-[--muted] text-xs">
                            {avgCost > 0
                              ? avgCost.toLocaleString('it-IT', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 4,
                                })
                              : '—'}
                          </span>
                        </Td>
                        <Td numeric>
                          {pos.lastPrice ? (
                            <div className="text-right">
                              <span className="text-[--ink]">
                                {parseFloat(pos.lastPrice).toLocaleString('it-IT', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 6,
                                })}
                              </span>
                              <p className="text-[10px] text-[--faint]">{fmtDate(pos.lastPriceAt)}</p>
                            </div>
                          ) : (
                            <Badge variant="warning">stale</Badge>
                          )}
                        </Td>
                        <Td numeric>
                          <span className="text-[--ink]">
                            {pos.marketValueMinor !== null
                              ? fromMinor(pos.marketValueMinor, 'EUR')
                              : '—'}
                          </span>
                        </Td>
                        <Td numeric>
                          {pl !== null ? (
                            <Badge variant={pl >= 0 ? 'gain' : 'loss'}>
                              {pl >= 0 ? '+' : ''}{fromMinor(pl, 'EUR')}
                              {pos.unrealizedPlPct && (
                                <span className="ml-1 opacity-75">
                                  ({pl >= 0 ? '+' : ''}{pos.unrealizedPlPct}%)
                                </span>
                              )}
                            </Badge>
                          ) : (
                            <span className="text-[--faint] text-xs">—</span>
                          )}
                        </Td>
                        <Td numeric>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingId(
                                editingId === pos.instrumentId ? null : pos.instrumentId,
                              )}
                              className="p-1.5 rounded-lg text-[--faint] hover:text-[--brand] hover:bg-[--brand-subtle] transition-colors"
                              title="Modifica quantità"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemove(pos.instrumentId)}
                              disabled={removePending}
                              className="p-1.5 rounded-lg text-[--faint] hover:text-[--danger] hover:bg-[--danger-subtle] transition-colors disabled:opacity-40"
                              title="Rimuovi posizione"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </Td>
                      </Tr>
                    )
                  })}
                </TableBody>
              </Table>
            </TableWrapper>
          </div>
        )}
      </div>

      {/* ── Aggiungi nuova crypto ─────────────────────────────────────────── */}
      <Card className="space-y-4">
        <CardHeader>
          <CardTitle as="h3">Aggiungi criptovaluta</CardTitle>
          {addingNew && selectedCoin && (
            <button
              type="button"
              onClick={() => { setAddingNew(false); setSelectedCoin(null) }}
              className="text-[--faint] hover:text-[--ink] transition-colors"
              aria-label="Annulla"
            >
              <X className="size-4" />
            </button>
          )}
        </CardHeader>

        {!addingNew || !selectedCoin ? (
          <CoinSearchBox onSelect={(coin) => { setSelectedCoin(coin); setAddingNew(true) }} />
        ) : (
          <HoldingForm
            portfolioId={portfolioId}
            coin={selectedCoin}
            onDone={() => { setAddingNew(false); setSelectedCoin(null) }}
            onCancel={() => { setAddingNew(false); setSelectedCoin(null) }}
          />
        )}
      </Card>
    </div>
  )
}
