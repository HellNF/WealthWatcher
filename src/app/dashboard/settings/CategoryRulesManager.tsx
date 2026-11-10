'use client'

import { useActionState, useTransition, useState } from 'react'
import {
  createCategoryRuleAction,
  deleteCategoryRuleAction,
  previewCategoriesAction, applyCategoriesAction,
} from './actions'
import {
  Button, TableWrapper, Table, TableHead, TableBody, Th, Tr, Td, Badge,
} from '@/components/ui'
import { Plus, Trash2, RefreshCw, Tag, Euro } from 'lucide-react'
import type { CategoryProposal } from '@/lib/categorization'
import { formatMoney } from '@/lib/money'
import type { CategoryRuleRow } from '@/lib/merchants'

function fmtAmount(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', { style: 'currency', useGrouping: 'always', currency: 'EUR' })
}

function AmountFilter({ min, max }: { min: number | null; max: number | null }) {
  if (min === null && max === null) return <span className="text-(--faint) text-xs">qualsiasi</span>
  if (min !== null && max !== null)
    return <span className="text-xs text-(--muted)">{fmtAmount(min)} – {fmtAmount(max)}</span>
  if (min !== null)
    return <span className="text-xs text-(--muted)">≥ {fmtAmount(min)}</span>
  return <span className="text-xs text-(--muted)">≤ {fmtAmount(max!)}</span>
}

interface Category { id: number; name: string; kind: string }

interface Props {
  rules:      CategoryRuleRow[]
  categories: Category[]
}

function RuleRow({ rule }: { rule: CategoryRuleRow }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm(`Eliminare la regola "${rule.pattern}"?`)) return
    startTransition(async () => { await deleteCategoryRuleAction(rule.id) })
  }

  return (
    <Tr>
      <Td>
        <code className="text-xs bg-(--surface-2) border border-(--border) rounded px-1.5 py-0.5 text-(--ink) font-mono">
          {rule.pattern}
        </code>
      </Td>
      <Td>
        <AmountFilter min={rule.amount_minor_min} max={rule.amount_minor_max} />
      </Td>
      <Td>
        <Badge variant="neutral">{rule.category_name}</Badge>
      </Td>
      <Td>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isPending}
          title={`Elimina regola "${rule.pattern}"`}
          className="text-(--danger) hover:bg-(--danger-subtle) disabled:opacity-30"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </Td>
    </Tr>
  )
}

function RecategorizeButton() {
  const [pending, start] = useTransition()
  const [preview, setPreview] = useState<{ proposals: CategoryProposal[]; total: number } | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [message, setMessage] = useState('')
  function load() {
    start(async () => {
      try {
        const result = await previewCategoriesAction()
        setPreview(result); setSelected(new Set(result.proposals.map(p => p.id))); setMessage('')
      } catch { setMessage('Impossibile caricare la revisione. Riprova.') }
    })
  }
  return <div className="space-y-3">
    <Button variant="secondary" size="sm" disabled={pending} loading={pending} onClick={load}>
      <RefreshCw className="size-3.5" /> Rivedi categorie dello storico
    </Button>
    <p className="text-xs text-(--muted)">Le scelte manuali, inclusa la rimozione della categoria, sono protette. Le assegnazioni precedenti senza provenienza sono indicate come storiche.</p>
    {preview && <div className="space-y-3">
      <p className="text-sm">{preview.total} modifiche proposte. {preview.total > 500 && 'Visualizzate le prime 500; ripeti la revisione per le successive.'}</p>
      <div className="max-h-80 overflow-auto space-y-2">
        {preview.proposals.map(p => <label key={p.id} className="flex gap-3 rounded-lg border border-(--border) p-3 text-sm">
          <input type="checkbox" checked={selected.has(p.id)} disabled={pending} onChange={e => {
            const next = new Set(selected); if (e.target.checked) next.add(p.id); else next.delete(p.id); setSelected(next)
          }} />
          <span><span className="block">{p.date} · {p.description} · {formatMoney(p.amountMinor, p.currency)}</span>
            <span className="text-(--muted)">{p.before ?? 'Senza categoria'} → {p.after ?? 'Senza categoria'} · {p.source === 'rule' ? 'Regola' : 'Automatica'}</span>
          </span>
        </label>)}
      </div>
      {selected.size > 0 && <Button size="sm" disabled={pending} loading={pending} onClick={() => start(async () => {
        try {
          const result = await applyCategoriesAction(preview.proposals.filter(p => selected.has(p.id)).map(({ id, fingerprint }) => ({ id, fingerprint })))
          setMessage(`${result.updated} movimenti aggiornati. ${result.skipped ? `${result.skipped} modificati nel frattempo: ricarica la revisione.` : ''}`)
          setPreview(null)
        } catch { setMessage('Applicazione non riuscita. Ricarica la revisione.') }
      })}>Applica {selected.size} modifiche selezionate</Button>}
    </div>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>
}

export default function CategoryRulesManager({ rules, categories }: Props) {
  const [createState, createAction, isCreating] = useActionState(createCategoryRuleAction, undefined)

  const expenseCategories = categories.filter((c) => c.kind === 'expense')
  const incomeCategories  = categories.filter((c) => c.kind === 'income')
  const otherCategories   = categories.filter((c) => c.kind !== 'expense' && c.kind !== 'income')

  return (
    <div className="space-y-6">
      {/* Spiegazione */}
      <p className="text-sm text-(--muted) leading-relaxed">
        Se la descrizione di un movimento contiene la parola chiave (ricerca case-insensitive),
        verrà assegnata la categoria indicata. Le regole si applicano durante l&apos;import e
        possono essere ri-applicate a tutti i movimenti esistenti.
      </p>

      {/* Tabella regole */}
      {rules.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-(--border) p-4 text-(--muted)">
          <Tag className="size-4 shrink-0" />
          <p className="text-sm">Nessuna regola ancora. Creane una qui sotto.</p>
        </div>
      ) : (
        <TableWrapper className="rounded-xl border border-(--border) overflow-hidden">
          <Table>
            <TableHead>
              <Tr>
                <Th>Parola chiave</Th>
                <Th>Importo</Th>
                <Th>Categoria</Th>
                <Th />
              </Tr>
            </TableHead>
            <TableBody>
              {rules.map((r) => (
                <RuleRow key={r.id} rule={r} />
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}

      {/* Form nuova regola */}
      <form action={createAction} className="space-y-3">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-40 space-y-1">
            <label htmlFor="rule-pattern" className="text-xs font-medium text-(--muted)">
              Parola chiave
            </label>
            <input
              id="rule-pattern"
              name="pattern"
              type="text"
              required
              placeholder="es. netflix, apple, abbonamento…"
              className="w-full h-9 rounded-lg border border-(--border) bg-(--surface-2) px-3 text-sm text-(--ink) placeholder:text-(--faint) focus:outline-none focus:ring-2 focus:ring-(--ring) focus:border-(--brand) transition-colors duration-150"
            />
          </div>

          {/* Filtro importo opzionale */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-(--muted) flex items-center gap-1">
              <Euro className="size-3" />
              Da (opz.)
            </label>
            <input
              name="amount_min"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              className="w-24 h-9 rounded-lg border border-(--border) bg-(--surface-2) px-3 text-sm text-(--ink) placeholder:text-(--faint) focus:outline-none focus:ring-2 focus:ring-(--ring) focus:border-(--brand) transition-colors duration-150"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-(--muted) flex items-center gap-1">
              <Euro className="size-3" />
              A (opz.)
            </label>
            <input
              name="amount_max"
              type="text"
              inputMode="decimal"
              placeholder="9,99"
              className="w-24 h-9 rounded-lg border border-(--border) bg-(--surface-2) px-3 text-sm text-(--ink) placeholder:text-(--faint) focus:outline-none focus:ring-2 focus:ring-(--ring) focus:border-(--brand) transition-colors duration-150"
            />
          </div>

          <div className="min-w-40 space-y-1">
            <label htmlFor="rule-category" className="text-xs font-medium text-(--muted)">
              Categoria
            </label>
            <select
              id="rule-category"
              name="category_id"
              required
              className="w-full h-9 rounded-lg border border-(--border) bg-(--surface-2) text-(--ink) px-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--ring)"
            >
              <option value="">— scegli —</option>
              {expenseCategories.length > 0 && (
                <optgroup label="Uscite">
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              )}
              {incomeCategories.length > 0 && (
                <optgroup label="Entrate">
                  {incomeCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              )}
              {otherCategories.length > 0 && (
                <optgroup label="Altro">
                  {otherCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <Button type="submit" variant="primary" size="sm" loading={isCreating} disabled={isCreating}>
            <Plus className="size-3.5" />
            Aggiungi
          </Button>
        </div>

        <p className="text-xs text-(--faint)">
          I campi importo filtrano sull&apos;importo assoluto del movimento (es. Da 0 A 5 cattura
          pagamenti fino a €5). Lasciali vuoti per applicare la regola a qualsiasi importo.
        </p>
      </form>

      {createState?.error   && <p className="text-sm text-(--danger)">{createState.error}</p>}
      {createState?.success && <p className="text-sm text-(--brand-text)">{createState.success}</p>}

      {/* Ricategorizza storico */}
      <div className="pt-4 border-t border-(--border) space-y-2">
        <p className="text-xs text-(--muted)">
          Applica le regole attuali a tutti i movimenti già importati.
        </p>
        <RecategorizeButton />
      </div>
    </div>
  )
}
