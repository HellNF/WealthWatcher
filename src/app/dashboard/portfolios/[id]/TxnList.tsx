'use client'
import { useTransition } from 'react'
import { deleteTxnAction } from './actions'
import { fromMinor } from '@/lib/money'
import type { InvestmentTxn } from '@/db/schema'

const TYPE_LABEL: Record<string, string> = {
  buy: 'Acquisto', sell: 'Vendita', dividend: 'Dividendo', fee: 'Commissione',
}
const TYPE_COLOR: Record<string, string> = {
  buy: 'text-emerald-400', sell: 'text-red-400',
  dividend: 'text-sky-400', fee: 'text-amber-400',
}

interface TxnWithSymbol extends InvestmentTxn {
  symbol: string
  instrument_name: string
}

function DeleteBtn({ portfolioId, txnId }: { portfolioId: number; txnId: number }) {
  const [isPending, startTransition] = useTransition()
  return (
    <button
      onClick={() => startTransition(() => deleteTxnAction(portfolioId, txnId))}
      disabled={isPending}
      className="text-xs text-zinc-600 hover:text-red-400 disabled:opacity-50 transition px-1"
    >
      {isPending ? '…' : '✕'}
    </button>
  )
}

export default function TxnList({
  txns,
  portfolioId,
}: {
  txns: TxnWithSymbol[]
  portfolioId: number
}) {
  if (txns.length === 0) return null

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-950">
            <th className="text-left px-4 py-2 text-zinc-500 font-medium">Data</th>
            <th className="text-left px-4 py-2 text-zinc-500 font-medium">Strumento</th>
            <th className="text-left px-4 py-2 text-zinc-500 font-medium">Tipo</th>
            <th className="text-right px-4 py-2 text-zinc-500 font-medium">Qtà</th>
            <th className="text-right px-4 py-2 text-zinc-500 font-medium">Prezzo</th>
            <th className="text-right px-4 py-2 text-zinc-500 font-medium">Comm.</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {[...txns].reverse().map((txn) => (
            <tr key={txn.id} className="bg-zinc-900 hover:bg-zinc-800/60 transition">
              <td className="px-4 py-2.5 text-zinc-400 tabular-nums text-xs whitespace-nowrap">
                {txn.trade_date}
              </td>
              <td className="px-4 py-2.5 text-zinc-300">
                <span className="font-medium">{txn.symbol}</span>
                <span className="text-zinc-600 ml-1 text-xs">{txn.instrument_name}</span>
              </td>
              <td className={`px-4 py-2.5 text-xs font-medium ${TYPE_COLOR[txn.type]}`}>
                {TYPE_LABEL[txn.type]}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-zinc-400 text-xs">
                {txn.quantity ?? '—'}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums font-mono text-xs text-zinc-400">
                {txn.unit_price ?? (txn.amount_minor !== null ? fromMinor(txn.amount_minor, txn.currency) : '—')}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums font-mono text-xs text-zinc-600">
                {txn.fee_minor > 0 ? fromMinor(txn.fee_minor, txn.currency) : '—'}
              </td>
              <td className="px-2">
                <DeleteBtn portfolioId={portfolioId} txnId={txn.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
