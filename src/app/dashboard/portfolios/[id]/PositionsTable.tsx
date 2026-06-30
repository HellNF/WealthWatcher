'use client'
import { useTransition } from 'react'
import { refreshPricesAction } from './actions'
import { fromMinor } from '@/lib/money'
import type { Position } from '@/lib/investments/fifo'

function fmtDate(epoch: number | null): string {
  if (!epoch) return '—'
  return new Date(epoch * 1000).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function PlCell({ minor, pct }: { minor: number | null; pct: string | null }) {
  if (minor === null) return <span className="text-zinc-600 text-xs">—</span>
  const positive = minor >= 0
  return (
    <span className={`tabular-nums font-mono ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
      {positive ? '+' : ''}{fromMinor(minor, 'EUR')}
      {pct && <span className="ml-1 text-xs opacity-75">({positive ? '+' : ''}{pct}%)</span>}
    </span>
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

  if (positions.length === 0) {
    return (
      <p className="text-sm text-zinc-500 py-6 text-center border border-dashed border-zinc-800 rounded-xl">
        Nessuna posizione. Aggiungi un&rsquo;operazione per iniziare.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={handleRefresh}
          disabled={isPending}
          className="rounded-lg border border-zinc-700 text-zinc-400 text-sm px-3 py-1.5
                     hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50 transition"
        >
          {isPending ? 'Aggiornamento…' : '↻ Aggiorna prezzi'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950">
              <th className="text-left px-4 py-2 text-zinc-500 font-medium">Strumento</th>
              <th className="text-right px-4 py-2 text-zinc-500 font-medium">Qtà</th>
              <th className="text-right px-4 py-2 text-zinc-500 font-medium">P.M. carico</th>
              <th className="text-right px-4 py-2 text-zinc-500 font-medium">Prezzo att.</th>
              <th className="text-right px-4 py-2 text-zinc-500 font-medium">Valore</th>
              <th className="text-right px-4 py-2 text-zinc-500 font-medium">P/L non realiz.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {positions.filter(p => parseFloat(p.remainingQty) > 0).map((pos) => {
              const avgCost = pos.costBasisMinor / Math.max(parseFloat(pos.remainingQty), 0.00000001) / 100
              return (
                <tr key={pos.symbol} className="bg-zinc-900 hover:bg-zinc-800/60 transition">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-100">{pos.name}</p>
                    <p className="text-xs text-zinc-500">{pos.symbol} · {pos.currency}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                    {parseFloat(pos.remainingQty).toLocaleString('it-IT', { maximumFractionDigits: 8 })}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-400 text-xs font-mono">
                    {avgCost.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {pos.lastPrice ? (
                      <div>
                        <span className="tabular-nums text-zinc-200 font-mono">{parseFloat(pos.lastPrice).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                        <p className="text-xs text-zinc-600">{fmtDate(pos.lastPriceAt)}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-amber-500">stale</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono text-zinc-200">
                    {pos.marketValueMinor !== null ? fromMinor(pos.marketValueMinor, pos.currency) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PlCell minor={pos.unrealizedPlMinor} pct={pos.unrealizedPlPct} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
