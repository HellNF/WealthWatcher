'use client'
import { useState, useTransition } from 'react'
import { updateCategoryAction, createRuleFromCorrectionAction } from './actions'
import { fromMinor } from '@/lib/money'
import type { TransactionRow } from '@/lib/transactions'
import {
  TableWrapper, Table, TableHead, TableBody, Th, Tr, Td,
  Badge, EmptyState,
  DataCard, DataCardHeader, DataRow,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { ReceiptText, Wand2, X, Check } from 'lucide-react'

interface Category { id: number; name: string; kind: string }

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function CategorySelect({
  txnId,
  currentCategoryId,
  descriptionRaw,
  categories,
}: {
  txnId:             number
  currentCategoryId: number | null
  descriptionRaw:    string
  categories:        Category[]
}) {
  const [isPending,  startTransition]  = useTransition()
  const [isCreating, startCreating]    = useTransition()
  const [selectedId, setSelectedId]    = useState<number | null>(currentCategoryId)
  const [showRule,   setShowRule]      = useState(false)
  const [keyword,    setKeyword]       = useState('')
  const [ruleMsg,    setRuleMsg]       = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val   = e.target.value
    const catId = val === '' ? null : parseInt(val, 10)
    setSelectedId(catId)
    setShowRule(false)
    setRuleMsg(null)
    startTransition(() => updateCategoryAction(txnId, catId))
    if (catId !== null) {
      const words = descriptionRaw.toLowerCase().replace(/[^a-zàèéìòù0-9 ]/g, ' ').split(/\s+/)
      const kw    = words.find((w) => w.length >= 4) ?? words[0] ?? ''
      setKeyword(kw)
      setShowRule(true)
    }
  }

  function handleConfirmRule() {
    if (!keyword.trim() || selectedId === null) return
    setRuleMsg(null)
    startCreating(async () => {
      const res = await createRuleFromCorrectionAction(keyword.trim(), selectedId)
      if (res.ok) {
        setRuleMsg(`Regola salvata: "${keyword.trim()}"`)
        setShowRule(false)
      } else {
        setRuleMsg(res.error ?? 'Errore')
      }
    })
  }

  return (
    <div className="space-y-1.5 w-full">
      <select
        value={selectedId ?? ''}
        onChange={handleChange}
        disabled={isPending}
        className={cn(
          'text-xs bg-[--surface-2] border border-[--border] rounded-md px-2 py-1',
          'text-[--ink] hover:border-[--brand] focus:outline-none focus:border-[--brand]',
          'focus:ring-1 focus:ring-[--ring] disabled:opacity-50 transition-colors duration-100',
          'w-full cursor-pointer',
        )}
      >
        <option value="">— nessuna —</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>{cat.name}</option>
        ))}
      </select>

      {showRule && (
        <div className="flex items-center gap-1 w-full">
          <Wand2 className="size-3 text-[--brand-text] shrink-0" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="parola chiave…"
            className={cn(
              'flex-1 min-w-0 text-xs bg-[--surface] border border-[--brand]/40 rounded-md px-2 py-1',
              'text-[--ink] focus:outline-none focus:border-[--brand] focus:ring-1 focus:ring-[--ring]',
            )}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmRule() }}
          />
          <button
            onClick={handleConfirmRule}
            disabled={isCreating || !keyword.trim()}
            title="Salva regola"
            className="size-6 flex items-center justify-center rounded text-[--brand-text] hover:bg-[--brand-subtle] disabled:opacity-40 transition-colors"
          >
            <Check className="size-3.5" />
          </button>
          <button
            onClick={() => { setShowRule(false); setRuleMsg(null) }}
            title="Ignora"
            className="size-6 flex items-center justify-center rounded text-[--muted] hover:bg-[--surface-2] transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {ruleMsg && (
        <p className="text-[10px] text-[--brand-text] flex items-center gap-1">
          <Check className="size-3 shrink-0" />
          {ruleMsg}
        </p>
      )}
    </div>
  )
}

export default function TransactionTable({
  transactions,
  categories,
}: {
  transactions: TransactionRow[]
  categories:   Category[]
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
    <>
      {/* ── Desktop: tabella ───────────────────────────────────────────────── */}
      <div className="hidden sm:block">
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
                      descriptionRaw={txn.description_raw}
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
      </div>

      {/* ── Mobile: card impilate ──────────────────────────────────────────── */}
      <div className="sm:hidden space-y-2">
        {transactions.map((txn) => (
          <DataCard key={txn.id}>
            <DataCardHeader
              title={txn.merchant_name || txn.description_raw}
              subtitle={!txn.merchant_name ? undefined : txn.description_raw}
              badge={
                <Badge variant={txn.amount_minor < 0 ? 'loss' : 'gain'}>
                  {txn.amount_minor >= 0 ? '+' : ''}
                  {fromMinor(txn.amount_minor, txn.currency)}
                </Badge>
              }
            />
            <div className="divide-y divide-[--border]">
              <DataRow label="Data">
                <span className="tabular-nums">{formatDate(txn.booked_date)}</span>
              </DataRow>
              <div className="py-2 space-y-1.5">
                <span className="text-xs text-[--muted]">Categoria</span>
                <CategorySelect
                  txnId={txn.id}
                  currentCategoryId={txn.category_id}
                  descriptionRaw={txn.description_raw}
                  categories={categories}
                />
              </div>
            </div>
          </DataCard>
        ))}
      </div>
    </>
  )
}
