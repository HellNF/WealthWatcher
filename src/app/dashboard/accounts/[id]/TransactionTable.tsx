'use client'
import { useTransition } from 'react'
import { updateCategoryAction } from './actions'
import { fromMinor } from '@/lib/money'
import type { TransactionRow } from '@/lib/transactions'

interface Category {
  id: number
  name: string
  kind: string
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function CategorySelect({
  txnId,
  currentCategoryId,
  categories,
}: {
  txnId: number
  currentCategoryId: number | null
  categories: Category[]
}) {
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value
    const catId = val === '' ? null : parseInt(val, 10)
    startTransition(() => updateCategoryAction(txnId, catId))
  }

  return (
    <select
      defaultValue={currentCategoryId ?? ''}
      onChange={handleChange}
      disabled={isPending}
      className="text-xs bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 text-zinc-300
                 hover:border-zinc-500 focus:outline-none focus:border-zinc-400
                 disabled:opacity-50 transition max-w-[160px]"
    >
      <option value="">— nessuna —</option>
      {categories.map((cat) => (
        <option key={cat.id} value={cat.id}>
          {cat.name}
        </option>
      ))}
    </select>
  )
}

export default function TransactionTable({
  transactions,
  categories,
}: {
  transactions: TransactionRow[]
  categories: Category[]
}) {
  if (transactions.length === 0) {
    return (
      <p className="text-sm text-zinc-500 py-6 text-center border border-dashed border-zinc-800 rounded-xl">
        Nessun movimento. Importa un file Excel da Intesa Sanpaolo.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-950">
            <th className="text-left px-4 py-2 text-zinc-500 font-medium">Data</th>
            <th className="text-left px-4 py-2 text-zinc-500 font-medium">Descrizione</th>
            <th className="text-left px-4 py-2 text-zinc-500 font-medium">Categoria</th>
            <th className="text-right px-4 py-2 text-zinc-500 font-medium">Importo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/50">
          {transactions.map((txn) => (
            <tr key={txn.id} className="bg-zinc-900 hover:bg-zinc-800/60 transition">
              <td className="px-4 py-2.5 text-zinc-400 tabular-nums text-xs whitespace-nowrap">
                {formatDate(txn.booked_date)}
              </td>
              <td className="px-4 py-2.5 text-zinc-200 max-w-xs truncate">
                {txn.merchant_name ? (
                  <>
                    <span className="font-medium">{txn.merchant_name}</span>
                    <span className="text-zinc-500 ml-2 text-xs">{txn.description_raw}</span>
                  </>
                ) : (
                  txn.description_raw
                )}
              </td>
              <td className="px-4 py-2.5">
                <CategorySelect
                  txnId={txn.id}
                  currentCategoryId={txn.category_id}
                  categories={categories}
                />
              </td>
              <td
                className={`px-4 py-2.5 text-right tabular-nums font-mono ${
                  txn.amount_minor < 0 ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {txn.amount_minor >= 0 ? '+' : ''}
                {fromMinor(txn.amount_minor, txn.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
