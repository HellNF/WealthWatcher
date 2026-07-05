'use client'
import { useState, useTransition } from 'react'
import { Pencil, X } from 'lucide-react'
import { deleteTxnAction } from './actions'
import { fromMinor } from '@/lib/money'
import type { InvestmentTxn } from '@/db/schema'
import {
  Badge,
  TableWrapper, Table, TableHead, TableBody, Th, Tr, Td,
  DataCard, DataCardHeader, DataRow,
} from '@/components/ui'
import { Fragment } from 'react'
import EditTxnForm from './EditTxnForm'

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
      {isPending ? <span className="text-xs">…</span> : <X className="size-3.5" />}
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
  const [editingId, setEditingId] = useState<number | null>(null)

  if (txns.length === 0) return null

  const reversed = [...txns].reverse()

  return (
    <>
      {/* ── Desktop: tabella ───────────────────────────────────────────────── */}
      <div className="hidden sm:block">
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
                <Th className="w-16" />
              </Tr>
            </TableHead>
            <TableBody>
              {reversed.map((txn) => (
                <Fragment key={txn.id}>
                  <Tr className={editingId === txn.id ? 'bg-[--surface-2]' : undefined}>
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
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          onClick={() => setEditingId(editingId === txn.id ? null : txn.id)}
                          aria-label="Modifica operazione"
                          className="text-[--faint] hover:text-[--brand-text] transition-colors duration-100 p-1"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <DeleteBtn portfolioId={portfolioId} txnId={txn.id} />
                      </div>
                    </Td>
                  </Tr>
                  {editingId === txn.id && (
                    <tr>
                      <td colSpan={7} className="p-2">
                        <EditTxnForm
                          txn={txn}
                          portfolioId={portfolioId}
                          onCancel={() => setEditingId(null)}
                          onSaved={() => setEditingId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      </div>

      {/* ── Mobile: card impilate ──────────────────────────────────────────── */}
      <div className="sm:hidden space-y-2">
        {reversed.map((txn) => (
          <Fragment key={txn.id}>
            <DataCard>
              <DataCardHeader
                title={txn.symbol}
                subtitle={txn.instrument_name || txn.trade_date}
                badge={
                  <Badge variant={TYPE_VARIANT[txn.type] ?? 'neutral'}>
                    {TYPE_LABEL[txn.type]}
                  </Badge>
                }
                actions={
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => setEditingId(editingId === txn.id ? null : txn.id)}
                      aria-label="Modifica operazione"
                      className="text-[--faint] hover:text-[--brand-text] transition-colors duration-100 p-1"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <DeleteBtn portfolioId={portfolioId} txnId={txn.id} />
                  </div>
                }
              />
              <div className="divide-y divide-[--border]">
                <DataRow label="Data">
                  <span className="tabular-nums">{txn.trade_date}</span>
                </DataRow>
                <DataRow label="Quantità · Prezzo">
                  <span className="tabular-nums">
                    {txn.quantity ?? '—'}
                    {' × '}
                    {txn.unit_price ?? (txn.amount_minor !== null
                      ? fromMinor(txn.amount_minor, txn.currency)
                      : '—')}
                  </span>
                </DataRow>
                {txn.fee_minor > 0 && (
                  <DataRow label="Commissioni">
                    <span className="tabular-nums text-[--faint]">
                      {fromMinor(txn.fee_minor, txn.currency)}
                    </span>
                  </DataRow>
                )}
              </div>
            </DataCard>
            {editingId === txn.id && (
              <div className="px-1">
                <EditTxnForm
                  txn={txn}
                  portfolioId={portfolioId}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => setEditingId(null)}
                />
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </>
  )
}
