'use client'
import { useTransition } from 'react'
import { RefreshCw, TrendingUp } from 'lucide-react'
import { refreshPricesAction } from './actions'
import { fromMinor } from '@/lib/money'
import type { Position } from '@/lib/investments/fifo'
import {
  Button, Badge, EmptyState,
  TableWrapper, Table, TableHead, TableBody, Th, Tr, Td,
} from '@/components/ui'

function fmtDate(epoch: number | null): string {
  if (!epoch) return '—'
  return new Date(epoch * 1000).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function PlCell({ minor, pct }: { minor: number | null; pct: string | null }) {
  if (minor === null) return <span className="text-[--faint] text-xs">—</span>
  const positive = minor >= 0
  return (
    <Badge variant={positive ? 'gain' : 'loss'}>
      {positive ? '+' : ''}{fromMinor(minor, 'EUR')}
      {pct && <span className="ml-1 opacity-75">({positive ? '+' : ''}{pct}%)</span>}
    </Badge>
  )
}

export default function PositionsTable({
  positions,
  portfolioId,
}: {
  positions: Position[]
  portfolioId: number
}) {
  const [isPending, startTransition] = useTransition()

  function handleRefresh() {
    startTransition(() => refreshPricesAction(portfolioId))
  }

  const activePositions = positions.filter(p => parseFloat(p.remainingQty) > 0)

  if (activePositions.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="Nessuna posizione"
        description="Aggiungi un'operazione di acquisto per iniziare a tracciare le tue posizioni."
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
          disabled={isPending}
          loading={isPending}
        >
          <RefreshCw className="size-3.5" />
          Aggiorna prezzi
        </Button>
      </div>

      <TableWrapper className="rounded-xl border border-[--border] overflow-hidden">
        <Table>
          <TableHead>
            <Tr>
              <Th>Strumento</Th>
              <Th className="text-right">Qtà</Th>
              <Th className="text-right">P.M. carico</Th>
              <Th className="text-right">Prezzo att.</Th>
              <Th className="text-right">Valore</Th>
              <Th className="text-right">P/L non real.</Th>
            </Tr>
          </TableHead>
          <TableBody>
            {activePositions.map((pos) => {
              const avgCost = pos.costBasisMinor /
                Math.max(parseFloat(pos.remainingQty), 0.00000001) / 100
              return (
                <Tr key={pos.symbol}>
                  <Td>
                    <p className="font-medium text-[--ink]">{pos.name}</p>
                    <p className="text-xs text-[--muted]">{pos.symbol} · {pos.currency}</p>
                  </Td>
                  <Td numeric>
                    <span className="text-[--ink]">
                      {parseFloat(pos.remainingQty).toLocaleString('it-IT', {
                        maximumFractionDigits: 8,
                      })}
                    </span>
                  </Td>
                  <Td numeric>
                    <span className="text-[--muted] text-xs">
                      {avgCost.toLocaleString('it-IT', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4,
                      })}
                    </span>
                  </Td>
                  <Td numeric>
                    {pos.lastPrice ? (
                      <div className="text-right">
                        <span className="text-[--ink]">
                          {parseFloat(pos.lastPrice).toLocaleString('it-IT', {
                            minimumFractionDigits: 2,
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
                        ? fromMinor(pos.marketValueMinor, pos.currency)
                        : '—'}
                    </span>
                  </Td>
                  <Td numeric>
                    <PlCell minor={pos.unrealizedPlMinor} pct={pos.unrealizedPlPct} />
                  </Td>
                </Tr>
              )
            })}
          </TableBody>
        </Table>
      </TableWrapper>
    </div>
  )
}
