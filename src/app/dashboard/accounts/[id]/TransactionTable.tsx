'use client'
import { useTransition } from 'react'
import { updateCategoryAction } from './actions'
import { fromMinor } from '@/lib/money'
import type { TransactionRow } from '@/lib/transactions'
import {
  TableWrapper, Table, TableHead, TableBody, Th, Tr, Td,
  Badge, EmptyState,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { ReceiptText } from 'lucide-react'

interface Category { id: number; name: string; kind: string }

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
      className={cn(
        'text-xs bg-[--surface-2] border border-[--border] rounded-md px-2 py-1',
        'text-[--ink] hover:border-[--brand] focus:outline-none focus:border-[--brand]',
        'focus:ring-1 focus:ring-[--ring] disabled:opacity-50 transition-colors duration-100',
        'max-w-[160px] cursor-pointer',
      )}
    >
      <option value="">— nessuna —</option>
      {categories.map((cat) => (
        <option key={cat.id} value={cat.id}>{cat.name}</option>
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
      <EmptyState
        icon={ReceiptText}
        title="Nessun movimento"
        description="Importa un file Excel da Intesa Sanpaolo per vedere i movimenti qui."
      />
    )
  }

  return (
    <TableWrapper className="rounded-xl border border-[--border] overflow-hidden">
      <Table>
        <TableHead>
          <Tr>
            <Th>Data</Th>
            <Th>Descrizione</Th>
            <Th>Categoria</Th>
            <Th className="text-right">Importo</Th>
          </Tr>
        </TableHead>
        <TableBody>
          {transactions.map((txn) => (
            <Tr key={txn.id}>
              <Td className="text-[--muted] text-xs whitespace-nowrap">
                {formatDate(txn.booked_date)}
              </Td>
              <Td className="max-w-xs">
                <div className="truncate">
                  {txn.merchant_name ? (
                    <>
                      <span className="font-medium text-[--ink]">{txn.merchant_name}</span>
                      <span className="text-[--faint] ml-2 text-xs">{txn.description_raw}</span>
                    </>
                  ) : (
                    <span className="text-[--ink]">{txn.description_raw}</span>
                  )}
                </div>
              </Td>
              <Td>
                <CategorySelect
                  txnId={txn.id}
                  currentCategoryId={txn.category_id}
                  categories={categories}
                />
              </Td>
              <Td numeric>
                <Badge variant={txn.amount_minor < 0 ? 'loss' : 'gain'}>
                  {txn.amount_minor >= 0 ? '+' : ''}
                  {fromMinor(txn.amount_minor, txn.currency)}
                </Badge>
              </Td>
            </Tr>
          ))}
        </TableBody>
      </Table>
    </TableWrapper>
  )
}
