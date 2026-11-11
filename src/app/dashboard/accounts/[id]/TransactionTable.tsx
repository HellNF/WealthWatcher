'use client'
import { useState, useTransition } from 'react'
import {
  updateCategoryAction,
  createRuleFromCorrectionAction,
  updateDescriptionAction,
  deleteTransactionAction,
} from './actions'
import { formatMoney } from '@/lib/money'
import type { TransactionRow } from '@/lib/transactions'
import {
  TableWrapper, Table, TableHead, TableBody, Th, Tr, Td,
  EmptyState,
  DataCard, DataCardHeader, DataRow, Select, Tooltip, ConfirmDialog,
} from '@/components/ui'
import { cn } from '@/lib/cn'
import { ReceiptText, Wand2, X, Check, Pencil, Trash2 } from 'lucide-react'

interface Category { id: number; name: string; kind: string }

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Da dove viene la categoria: l'utente deve poter distinguere una sua scelta
// da un'assegnazione automatica o da un suggerimento dello storico.
function sourceLabel(source: string | undefined, short = false): string {
  switch (source) {
    case 'manual':    return 'Manuale · protetta'
    case 'rule':      return 'Regola'
    case 'automatic': return 'Automatica'
    case 'learned':   return 'Suggerita dallo storico · da verificare'
    default:          return short ? 'Storica' : 'Storica · origine non registrata'
  }
}

function CategorySelect({
  txnId,
  currentCategoryId,
  descriptionRaw,
  categories,
  source,
}: {
  txnId:             number
  currentCategoryId: number | null
  descriptionRaw:    string
  categories:        Category[]
  source?:           string
}) {
  const [isPending,  startTransition]  = useTransition()
  const [isCreating, startCreating]    = useTransition()
  const [selectedId, setSelectedId]    = useState<number | null>(currentCategoryId)
  const [showRule,   setShowRule]      = useState(false)
  const [keyword,    setKeyword]       = useState('')
  const [ruleMsg,    setRuleMsg]       = useState<string | null>(null)
  const [confirmed,  setConfirmed]     = useState(false)

  function handleChange(val: string) {
    const catId = val === '' ? null : parseInt(val, 10)
    setSelectedId(catId)
    setConfirmed(true)
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
      <Select
        size="sm"
        aria-label="Categoria del movimento"
        value={selectedId === null ? '' : String(selectedId)}
        onValueChange={handleChange}
        disabled={isPending}
        options={[{ value: '', label: 'Nessuna' }, ...categories.map((cat) => ({ value: String(cat.id), label: cat.name }))]}
      />

      {source === 'learned' && selectedId !== null && !confirmed && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => { setConfirmed(true); startTransition(() => updateCategoryAction(txnId, selectedId)) }}
          className="inline-flex items-center gap-1 text-xs text-(--brand-text) hover:underline disabled:opacity-50"
        >
          <Check className="size-3" aria-hidden /> Conferma suggerimento
        </button>
      )}

      {showRule && (
        <div className="flex items-center gap-1 w-full">
          <Wand2 className="size-3 text-(--brand-text) shrink-0" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="parola chiave…"
            className={cn(
              'flex-1 min-w-0 text-xs bg-(--surface) border border-(--brand)/40 rounded-md px-2 py-1',
              'text-(--ink) focus:outline-none focus:border-(--brand) focus:ring-1 focus:ring-(--ring)',
            )}
            onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmRule() }}
          />
          <Tooltip content="Salva regola">
            <button
              aria-label="Salva regola"
              onClick={handleConfirmRule}
              disabled={isCreating || !keyword.trim()}
              className="size-6 flex items-center justify-center rounded text-(--brand-text) hover:bg-(--brand-subtle) disabled:opacity-40 transition-colors"
            >
              <Check className="size-3.5" />
            </button>
          </Tooltip>
          <Tooltip content="Ignora">
            <button
              aria-label="Ignora"
              onClick={() => { setShowRule(false); setRuleMsg(null) }}
              className="size-6 flex items-center justify-center rounded text-(--muted) hover:bg-(--surface-2) transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </Tooltip>
        </div>
      )}

      {ruleMsg && (
        <p className="text-[10px] text-(--brand-text) flex items-center gap-1">
          <Check className="size-3 shrink-0" />
          {ruleMsg}
        </p>
      )}
    </div>
  )
}

function DescriptionCell({
  txnId,
  merchantName,
  descriptionRaw,
}: {
  txnId:          number
  merchantName:   string | null
  descriptionRaw: string
}) {
  const [editing,  setEditing]  = useState(false)
  const [value,    setValue]    = useState(descriptionRaw)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!value.trim() || value.trim() === descriptionRaw) { setEditing(false); return }
    startTransition(async () => {
      await updateDescriptionAction(txnId, value.trim())
      setEditing(false)
    })
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 w-full">
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') { setValue(descriptionRaw); setEditing(false) }
          }}
          className={cn(
            'flex-1 min-w-0 text-xs bg-(--surface) border border-(--brand)/60 rounded-md px-2 py-1',
            'text-(--ink) focus:outline-none focus:border-(--brand) focus:ring-1 focus:ring-(--ring)',
          )}
        />
        <Tooltip content="Salva">
          <button
            aria-label="Salva"
            onClick={handleSave}
            disabled={isPending || !value.trim()}
            className="size-6 flex items-center justify-center rounded text-(--brand-text) hover:bg-(--brand-subtle) disabled:opacity-40 transition-colors"
          >
            <Check className="size-3.5" />
          </button>
        </Tooltip>
        <Tooltip content="Annulla">
          <button
            aria-label="Annulla"
            onClick={() => { setValue(descriptionRaw); setEditing(false) }}
            className="size-6 flex items-center justify-center rounded text-(--muted) hover:bg-(--surface-2) transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 group/desc min-w-0">
      <div className="min-w-0 [overflow-wrap:anywhere]">
        {merchantName ? (
          <>
            <span className="font-medium text-(--ink)">{merchantName}</span>
            <span className="text-(--faint) ml-2 text-xs">{value}</span>
          </>
        ) : (
          <span className="text-(--ink)">{value}</span>
        )}
      </div>
      <Tooltip content="Modifica descrizione">
        <button
          onClick={() => setEditing(true)}
          aria-label="Modifica descrizione"
          className="shrink-0 size-5 flex items-center justify-center rounded text-(--faint) opacity-0 group-hover/desc:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100 hover:text-(--ink) hover:bg-(--surface-2) transition-all"
        >
          <Pencil className="size-3" />
        </button>
      </Tooltip>
    </div>
  )
}

function DeleteButton({ txnId }: { txnId: number }) {
  return (
    <ConfirmDialog
      title="Eliminare questo movimento?"
      description="Sparisce anche dai report e dal patrimonio netto. L’operazione non si può annullare."
      onConfirm={() => deleteTransactionAction(txnId)}
      tooltip="Elimina movimento"
      trigger={
        <button
          aria-label="Elimina movimento"
          className="size-7 flex items-center justify-center rounded-md text-(--muted) hover:text-(--danger-text) hover:bg-(--danger-subtle) active:scale-90 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 [@media(hover:none)]:opacity-100 transition-[opacity,color,background-color,scale] duration-150 ease-out-strong"
        >
          <Trash2 className="size-3.5" />
        </button>
      }
    />
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
        <TableWrapper className="rounded-2xl border border-(--border) bg-(--surface) overflow-hidden">
          <Table>
            <TableHead>
              <Tr>
                <Th>Data</Th>
                <Th>Descrizione</Th>
                <Th>Categoria</Th>
                <Th className="text-right">Importo</Th>
                <Th className="w-8" />
              </Tr>
            </TableHead>
            <TableBody>
              {transactions.map((txn) => (
                <Tr key={txn.id} className="group/row">
                  <Td className="text-(--muted) text-xs whitespace-nowrap tabular-nums">
                    {formatDate(txn.booked_date)}
                  </Td>
                  <Td className="whitespace-normal min-w-48">
                    <DescriptionCell
                      txnId={txn.id}
                      merchantName={txn.merchant_name}
                      descriptionRaw={txn.description_raw}
                    />
                  </Td>
                  <Td className="whitespace-normal w-44 min-w-36">
                    <p className="text-xs text-(--muted) mb-1">{sourceLabel(txn.category_source)}{txn.possible_duplicate ? ' · Possibile duplicato' : ''}</p>
                    <CategorySelect
                      txnId={txn.id}
                      currentCategoryId={txn.category_id}
                      descriptionRaw={txn.description_raw}
                      categories={categories}
                      source={txn.category_source}
                    />
                  </Td>
                  <Td numeric>
                    {/* Uscite neutre, entrate in verde: il colore segnala solo ciò che entra */}
                    <span className={txn.amount_minor > 0 ? 'text-(--brand-text) font-medium' : 'text-(--ink)'}>
                      {txn.amount_minor > 0 ? '+' : ''}
                      {formatMoney(txn.amount_minor, txn.currency)}
                    </span>
                  </Td>
                  <Td>
                    <DeleteButton txnId={txn.id} />
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
                <span className={`font-mono tabular-nums text-sm ${txn.amount_minor > 0 ? 'text-(--brand-text) font-medium' : 'text-(--ink)'}`}>
                  {txn.amount_minor > 0 ? '+' : ''}
                  {formatMoney(txn.amount_minor, txn.currency)}
                </span>
              }
            />
            <div className="divide-y divide-(--border)">
              <DataRow label="Data">
                <span className="tabular-nums">{formatDate(txn.booked_date)}</span>
              </DataRow>
              <div className="py-2 space-y-1.5">
                <span className="text-xs text-(--muted)">Categoria · {sourceLabel(txn.category_source, true)}{txn.possible_duplicate ? ' · Possibile duplicato' : ''}</span>
                <CategorySelect
                  txnId={txn.id}
                  currentCategoryId={txn.category_id}
                  descriptionRaw={txn.description_raw}
                  categories={categories}
                  source={txn.category_source}
                />
              </div>
              <DataRow label="">
                <DeleteButton txnId={txn.id} />
              </DataRow>
            </div>
          </DataCard>
        ))}
      </div>
    </>
  )
}
