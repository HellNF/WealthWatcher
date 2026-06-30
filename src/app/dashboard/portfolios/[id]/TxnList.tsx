'use client'
import { useTransition } from 'react'
import { X } from 'lucide-react'
import { deleteTxnAction } from './actions'
import { fromMinor } from '@/lib/money'
import type { InvestmentTxn } from '@/db/schema'
import {
  Badge,
  TableWrapper, Table, TableHead, TableBody, Th, Tr, Td,
} from '@/components/ui'

const TYPE_LABEL: Record<string, string> = {
  buy: 'Acquisto', sell: 'Vendita', dividend: 'Dividendo', fee: 'Commissione',
}
const TYPE_VARIANT: Record<string, 'success' | 'danger' | 'info' | 'warning'> = {
  buy:      'success',
  sell:     'danger',
  dividend: 'info',
  fee:      'warning',
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
      aria-label="Elimina operazione"
      className="text-[--faint] hover:text-[--danger] disabled:opacity-40 transition-colors duration-100 p-1"
    >
      {isPending ? (
        <span className="text-xs">…</span>
      ) : (
        <X className="size-3.5" />
      )}
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
    <TableWrapper className="rounded-xl border border-[--border] overflow-hidden">
      <Table>
        <TableHead>
          <Tr>
            <Th>Data</Th>
            <Th>Strumento</Th>
            <Th>Tipo</Th>
            <Th className="text-right">Qtà</Th>
            <Th className="text-right">Prezzo</Th>
            <Th className="text-right">Comm.</Th>
            <Th className="w-8" />
          </Tr>
        </TableHead>
        <TableBody>
          {[...txns].reverse().map((txn) => (
            <Tr key={txn.id}>
              <Td className="text-[--muted] text-xs tabular-nums whitespace-nowrap">
                {txn.trade_date}
              </Td>
              <Td>
                <span className="font-medium text-[--ink]">{txn.symbol}</span>
                <span className="text-[--faint] ml-1.5 text-xs">{txn.instrument_name}</span>
              </Td>
              <Td>
                <Badge variant={TYPE_VARIANT[txn.type] ?? 'neutral'}>
                  {TYPE_LABEL[txn.type]}
                </Badge>
              </Td>
              <Td numeric className="text-[--muted] text-xs">{txn.quantity ?? '—'}</Td>
              <Td numeric className="text-[--muted] text-xs">
                {txn.unit_price ?? (txn.amount_minor !== null
                  ? fromMinor(txn.amount_minor, txn.currency)
                  : '—')}
              </Td>
              <Td numeric className="text-[--faint] text-xs">
                {txn.fee_minor > 0 ? fromMinor(txn.fee_minor, txn.currency) : '—'}
              </Td>
              <Td className="pr-2">
                <DeleteBtn portfolioId={portfolioId} txnId={txn.id} />
              </Td>
            </Tr>
          ))}
        </TableBody>
      </Table>
    </TableWrapper>
  )
}
