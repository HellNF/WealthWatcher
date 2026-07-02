'use client'

import { useActionState, useTransition } from 'react'
import {
  createCategoryRuleAction,
  deleteCategoryRuleAction,
  recategorizeAllAction,
} from './actions'
import {
  Button, TableWrapper, Table, TableHead, TableBody, Th, Tr, Td, Badge,
} from '@/components/ui'
import { Plus, Trash2, RefreshCw, Tag } from 'lucide-react'
import type { CategoryRuleRow } from '@/lib/merchants'

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
        <code className="text-xs bg-[--surface-2] border border-[--border] rounded px-1.5 py-0.5 text-[--ink] font-mono">
          {rule.pattern}
        </code>
      </Td>
      <Td>
        <Badge variant="neutral">{rule.category_name}</Badge>
      </Td>
      <Td>
        {rule.priority !== 0 && (
          <span className="text-xs tabular-nums text-[--muted]">{rule.priority}</span>
        )}
      </Td>
      <Td>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isPending}
          title={`Elimina regola "${rule.pattern}"`}
          className="text-[--danger] hover:bg-[--danger-subtle] disabled:opacity-30"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </Td>
    </Tr>
  )
}

function RecategorizeButton() {
  const [state, action, pending] = useActionState(recategorizeAllAction, undefined)

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <form action={action}>
        <Button type="submit" variant="secondary" size="sm" loading={pending} disabled={pending}>
          <RefreshCw className="size-3.5" />
          Ricategorizza storico
        </Button>
      </form>
      {state?.success && <p className="text-sm text-[--brand-text]">{state.success}</p>}
      {state?.error   && <p className="text-sm text-[--danger]">{state.error}</p>}
    </div>
  )
}

export default function CategoryRulesManager({ rules, categories }: Props) {
  const [createState, createAction, isCreating] = useActionState(createCategoryRuleAction, undefined)

  const expenseCategories = categories.filter((c) => c.kind === 'expense')
  const incomeCategories  = categories.filter((c) => c.kind === 'income')
  const otherCategories   = categories.filter((c) => c.kind !== 'expense' && c.kind !== 'income')

  return (
    <div className="space-y-6">
      {/* Spiegazione */}
      <p className="text-sm text-[--muted] leading-relaxed">
        Se la descrizione di un movimento contiene la parola chiave (ricerca case-insensitive),
        verrà assegnata la categoria indicata. Le regole si applicano durante l&apos;import e
        possono essere ri-applicate a tutti i movimenti esistenti.
      </p>

      {/* Tabella regole */}
      {rules.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-[--border] p-4 text-[--muted]">
          <Tag className="size-4 shrink-0" />
          <p className="text-sm">Nessuna regola ancora. Creane una qui sotto.</p>
        </div>
      ) : (
        <TableWrapper className="rounded-xl border border-[--border] overflow-hidden">
          <Table>
            <TableHead>
              <Tr>
                <Th>Parola chiave</Th>
                <Th>Categoria</Th>
                <Th>Priorità</Th>
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
      <form action={createAction} className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-40 space-y-1">
          <label htmlFor="rule-pattern" className="text-xs font-medium text-[--muted]">
            Parola chiave
          </label>
          <input
            id="rule-pattern"
            name="pattern"
            type="text"
            required
            placeholder="es. netflix, amazon, abbonamento…"
            className="w-full h-9 rounded-lg border border-[--border] bg-[--surface-2] px-3 text-sm text-[--ink] placeholder:text-[--faint] focus:outline-none focus:ring-2 focus:ring-[--ring] focus:border-[--brand] transition-colors duration-150"
          />
        </div>
        <div className="min-w-40 space-y-1">
          <label htmlFor="rule-category" className="text-xs font-medium text-[--muted]">
            Categoria
          </label>
          <select
            id="rule-category"
            name="category_id"
            required
            className="w-full h-9 rounded-lg border border-[--border] bg-[--surface-2] text-[--ink] px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[--ring]"
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
          Aggiungi regola
        </Button>
      </form>

      {createState?.error   && <p className="text-sm text-[--danger]">{createState.error}</p>}
      {createState?.success && <p className="text-sm text-[--brand-text]">{createState.success}</p>}

      {/* Ricategorizza storico */}
      <div className="pt-4 border-t border-[--border] space-y-2">
        <p className="text-xs text-[--muted]">
          Applica le regole attuali a tutti i movimenti già importati.
        </p>
        <RecategorizeButton />
      </div>
    </div>
  )
}
