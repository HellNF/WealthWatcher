'use client'

import { useActionState } from 'react'
import { saveBudgetAction, deleteBudgetAction } from './actions'
import {
  Button, ConfirmDelete, Input, Select,
} from '@/components/ui'
import { Plus, Target } from 'lucide-react'
import type { BudgetWithCategory } from '@/lib/budgets'

function fmtEur(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', { style: 'currency', useGrouping: 'always', currency: 'EUR' })
}

interface Category { id: number; name: string; kind: string }

interface Props {
  budgets:    BudgetWithCategory[]
  categories: Category[]
}

/** Conferma in linea (niente finestra di dialogo del browser). */
function DeleteBudgetBtn({ budget }: { budget: BudgetWithCategory }) {
  return (
    <ConfirmDelete
      action={deleteBudgetAction.bind(null, budget.id)}
      label=""
      confirmText="Eliminare?"
    />
  )
}

export default function BudgetsManager({ budgets, categories }: Props) {
  const [state, formAction, isPending] = useActionState(saveBudgetAction, undefined)

  const existingCatIds = new Set(budgets.map((b) => b.category_id).filter(Boolean))
  const expenseCategories = categories.filter(
    (c) => c.kind === 'expense' && !existingCatIds.has(c.id),
  )

  const hasTotal = budgets.some((b) => b.category_id === null)

  return (
    <div className="space-y-5">
      {/* Elenco limiti */}
      {budgets.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-(--border) p-4 text-(--muted)">
          <Target className="size-4 shrink-0" />
          <p className="text-sm">Nessun limite impostato. Aggiungi il primo qui sotto.</p>
        </div>
      ) : (
        <ul className="divide-y divide-(--border) rounded-xl border border-(--border) overflow-hidden">
          {budgets.map((b) => (
            <li key={b.id} className="flex items-center gap-3 px-3.5 py-2.5 min-h-12">
              <span className="flex items-center gap-2.5 min-w-0 flex-1 text-sm text-(--ink)">
                {b.category_color
                  ? <span className="size-2.5 rounded-full shrink-0" style={{ background: b.category_color }} aria-hidden />
                  : <Target className="size-3.5 shrink-0 text-(--muted)" strokeWidth={1.75} aria-hidden />}
                <span className="truncate">{b.category_name ?? <span className="font-medium">Tetto mensile complessivo</span>}</span>
              </span>
              <span className="shrink-0 text-sm font-mono tabular-nums text-(--ink)">{fmtEur(b.amount_minor)}</span>
              <DeleteBudgetBtn budget={b} />
            </li>
          ))}
        </ul>
      )}

      {/* Form nuovo budget */}
      <form action={formAction} className="space-y-3">
        <div className="flex items-end gap-2.5 flex-wrap">
          {/* Selezione categoria */}
          <div className="basis-full min-w-0 space-y-1.5">
            <label htmlFor="budget-category" className="text-xs font-medium text-(--muted)">
              Categoria
            </label>
            <Select id="budget-category" name="category_id">
              {!hasTotal && <option value="">Tetto mensile complessivo</option>}
              {expenseCategories.length > 0 && (
                <optgroup label="Uscite">
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              )}
              {hasTotal && expenseCategories.length === 0 && (
                <option disabled value="">Tutte le categorie hanno già un budget</option>
              )}
            </Select>
          </div>

          {/* Importo */}
          <div className="flex-1 min-w-28 space-y-1.5">
            <label htmlFor="budget-amount" className="text-xs font-medium text-(--muted)">
              Limite (€/mese)
            </label>
            <Input id="budget-amount" name="amount" type="text" inputMode="decimal" required placeholder="400" />
          </div>

          <Button
            type="submit"
            variant="primary"
            loading={isPending}
            disabled={isPending || (hasTotal && expenseCategories.length === 0)}
          >
            <Plus className="size-4" strokeWidth={1.75} />
            Aggiungi
          </Button>
        </div>

        {state?.error   && <p className="text-sm text-(--danger-text)" role="alert">{state.error}</p>}
        {state?.success && <p className="text-sm text-(--muted)" aria-live="polite">{state.success}</p>}
      </form>
    </div>
  )
}
