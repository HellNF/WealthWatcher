'use client'

import { useActionState, useTransition } from 'react'
import { saveBudgetAction, deleteBudgetAction } from './actions'
import {
  Button, TableWrapper, Table, TableHead, TableBody, Th, Tr, Td,
  DataCard, DataCardHeader, DataRow,
} from '@/components/ui'
import { Plus, Trash2, Target } from 'lucide-react'
import type { BudgetWithCategory } from '@/lib/budgets'

function fmtEur(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

interface Category { id: number; name: string; kind: string }

interface Props {
  budgets:    BudgetWithCategory[]
  categories: Category[]
}

function DeleteBudgetBtn({ budget }: { budget: BudgetWithCategory }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    const label = budget.category_name ?? 'budget totale'
    if (!confirm(`Eliminare il ${label}?`)) return
    startTransition(async () => { await deleteBudgetAction(budget.id) })
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={isPending}
      title="Elimina budget"
      className="text-[--danger] hover:bg-[--danger-subtle] disabled:opacity-30"
    >
      <Trash2 className="size-3.5" />
    </Button>
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
    <div className="space-y-6">
      {/* Tabella budget */}
      {budgets.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-[--border] p-4 text-[--muted]">
          <Target className="size-4 shrink-0" />
          <p className="text-sm">Nessun budget ancora. Creane uno qui sotto.</p>
        </div>
      ) : (
        <>
          {/* ── Desktop ─────────────────────────────────────────────────────── */}
          <div className="hidden sm:block">
            <TableWrapper className="rounded-xl border border-[--border] overflow-hidden">
              <Table>
                <TableHead>
                  <Tr>
                    <Th>Categoria</Th>
                    <Th>Limite / mese</Th>
                    <Th />
                  </Tr>
                </TableHead>
                <TableBody>
                  {budgets.map((b) => (
                    <Tr key={b.id}>
                      <Td>
                        <span className="flex items-center gap-2 text-sm text-[--ink]">
                          {b.category_color && (
                            <span
                              className="size-2.5 rounded-full shrink-0"
                              style={{ background: b.category_color }}
                            />
                          )}
                          {b.category_name ?? (
                            <span className="font-medium text-[--brand-text]">Totale mensile</span>
                          )}
                        </span>
                      </Td>
                      <Td numeric>
                        <span className="text-sm font-medium tabular-nums text-[--ink]">
                          {fmtEur(b.amount_minor)}
                        </span>
                      </Td>
                      <Td>
                        <DeleteBudgetBtn budget={b} />
                      </Td>
                    </Tr>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          </div>

          {/* ── Mobile: card impilate ──────────────────────────────────────── */}
          <div className="sm:hidden space-y-2">
            {budgets.map((b) => (
              <DataCard key={b.id}>
                <DataCardHeader
                  title={
                    b.category_name ?? (
                      <span className="text-[--brand-text]">Totale mensile</span>
                    )
                  }
                  badge={
                    b.category_color ? (
                      <span
                        className="size-2.5 rounded-full shrink-0 inline-block"
                        style={{ background: b.category_color }}
                      />
                    ) : undefined
                  }
                  actions={<DeleteBudgetBtn budget={b} />}
                />
                <DataRow label="Limite / mese">
                  <span className="font-medium tabular-nums">{fmtEur(b.amount_minor)}</span>
                </DataRow>
              </DataCard>
            ))}
          </div>
        </>
      )}

      {/* Form nuovo budget */}
      <form action={formAction} className="space-y-3">
        <div className="flex items-end gap-3 flex-wrap">
          {/* Selezione categoria */}
          <div className="flex-1 min-w-0 space-y-1">
            <label htmlFor="budget-category" className="text-xs font-medium text-[--muted]">
              Categoria
            </label>
            <select
              id="budget-category"
              name="category_id"
              className="w-full h-9 rounded-lg border border-[--border] bg-[--surface-2] text-[--ink] px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[--ring]"
            >
              {!hasTotal && <option value="">Totale mensile</option>}
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
            </select>
          </div>

          {/* Importo */}
          <div className="w-full sm:w-36 space-y-1">
            <label htmlFor="budget-amount" className="text-xs font-medium text-[--muted]">
              Limite (€ / mese)
            </label>
            <input
              id="budget-amount"
              name="amount"
              type="text"
              inputMode="decimal"
              required
              placeholder="es. 400"
              className="w-full h-9 rounded-lg border border-[--border] bg-[--surface-2] px-3 text-sm text-[--ink] placeholder:text-[--faint] focus:outline-none focus:ring-2 focus:ring-[--ring] focus:border-[--brand] transition-colors duration-150"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={isPending}
            disabled={isPending || (hasTotal && expenseCategories.length === 0)}
            className="w-full sm:w-auto"
          >
            <Plus className="size-3.5" />
            Aggiungi
          </Button>
        </div>

        {state?.error   && <p className="text-sm text-[--danger]">{state.error}</p>}
        {state?.success && <p className="text-sm text-[--brand-text]">{state.success}</p>}
      </form>
    </div>
  )
}
