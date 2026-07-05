import Link from 'next/link'
import { requireUser } from '@/lib/dal'
import { listBudgets, budgetStatus } from '@/lib/budgets'
import { listAllCategories } from '@/lib/transactions'
import { availableMonths } from '@/lib/reports'
import { Target } from 'lucide-react'
import {
  Breadcrumb, Card, EmptyState,
} from '@/components/ui'
import BudgetsManager from './BudgetsManager'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ month?: string }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function MonthLabel(m: string): string {
  const [y, mo] = m.split('-')
  const months = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
  return `${months[parseInt(mo, 10) - 1]} ${y}`
}

function FilterPill({ href, active, children }: {
  href: string; active: boolean; children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={[
        'px-3 py-1.5 rounded-lg text-sm transition-all duration-150 whitespace-nowrap',
        active
          ? 'bg-[--brand] text-[--brand-fg] font-medium shadow-sm'
          : 'text-[--muted] hover:text-[--ink]',
      ].join(' ')}
    >
      {children}
    </Link>
  )
}

function fmtEur(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

/** Ritorna il colore della barra in base alla percentuale consumata. */
function barColor(pct: number): string {
  if (pct >= 100) return 'var(--danger)'
  if (pct >= 80)  return 'var(--warning, #f59e0b)'
  return 'var(--brand)'
}

function BudgetBar({
  spent, limit, pct,
}: { spent: number; limit: number; pct: number }) {
  const clamped = Math.min(pct, 100)
  const color   = barColor(pct)
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-[--muted] text-xs tabular-nums">
          {fmtEur(spent)} <span className="text-[--faint]">/ {fmtEur(limit)}</span>
        </span>
        <span
          className="text-xs font-medium tabular-nums shrink-0"
          style={{ color }}
        >
          {pct}%
          {pct >= 100 && <span className="ml-1 text-[--danger]">⚠</span>}
        </span>
      </div>
      <div className="h-2 bg-[--surface-2] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
    </div>
  )
}

// ── Pagina ────────────────────────────────────────────────────────────────────

export default async function BudgetsPage({ searchParams }: Props) {
  const { month: monthParam } = await searchParams
  const user       = await requireUser()
  const budgetList = listBudgets(user.id)
  const categories = listAllCategories()

  // Mese corrente come default
  const today    = new Date().toISOString().slice(0, 7) // YYYY-MM
  const months   = availableMonths(user.id)
  const month    = monthParam ?? months[0] ?? today
  const status   = budgetList.length > 0 ? budgetStatus(user.id, month) : null

  const hasCategoryBudgets = status !== null && status.perCategory.length > 0
  const hasTotalBudget     = status !== null && status.total.limit_minor !== null

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Budget' },
      ]} />

      {/* ── Selettore mese ────────────────────────────────────────────────── */}
      {months.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[--muted] w-10 shrink-0">Mese</span>
          <div className="flex gap-0.5 flex-wrap p-1 bg-[--surface-2] rounded-xl">
            {months.slice(0, 12).map((m) => (
              <FilterPill
                key={m}
                href={`/dashboard/budgets?month=${m}`}
                active={m === month}
              >
                {MonthLabel(m)}
              </FilterPill>
            ))}
          </div>
        </div>
      )}

      {/* ── Stato budget del mese ─────────────────────────────────────────── */}
      {status && (hasTotalBudget || hasCategoryBudgets) ? (
        <div className="space-y-6">

          {/* Hero tetto totale */}
          {hasTotalBudget && (
            <Card className="space-y-4">
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">
                    Tetto mensile complessivo
                  </p>
                  <p className="text-3xl font-bold font-mono tabular-nums text-[--ink] mt-1 leading-none">
                    {fmtEur(status.total.spent_minor)}
                  </p>
                  <p className="text-sm text-[--muted] mt-0.5">
                    su {fmtEur(status.total.limit_minor!)} budget
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className="text-2xl font-bold font-mono tabular-nums"
                    style={{ color: barColor(status.total.pct ?? 0) }}
                  >
                    {status.total.pct}%
                  </p>
                  <p className="text-xs text-[--muted]">consumato</p>
                </div>
              </div>
              <BudgetBar
                spent={status.total.spent_minor}
                limit={status.total.limit_minor!}
                pct={status.total.pct!}
              />
            </Card>
          )}

          {/* Budget per categoria */}
          {hasCategoryBudgets && (
            <Card className="space-y-4">
              <h2 className="text-sm font-semibold text-[--ink]">Per categoria</h2>
              <div className="space-y-5 divide-y divide-[--border]">
                {status.perCategory.map((cat, i) => (
                  <div key={i} className={`space-y-2 ${i > 0 ? 'pt-4' : ''}`}>
                    <div className="flex items-center gap-2">
                      {cat.color && (
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ background: cat.color }}
                        />
                      )}
                      <span className="text-sm font-medium text-[--ink]">
                        {cat.category_name ?? 'Senza categoria'}
                      </span>
                      {cat.pct >= 100 && (
                        <span className="ml-auto text-xs font-medium text-[--danger]">
                          +{fmtEur(cat.spent_minor - cat.limit_minor)} sforato
                        </span>
                      )}
                      {cat.pct < 100 && (
                        <span className="ml-auto text-xs text-[--muted]">
                          {fmtEur(cat.limit_minor - cat.spent_minor)} rimanenti
                        </span>
                      )}
                    </div>
                    <BudgetBar
                      spent={cat.spent_minor}
                      limit={cat.limit_minor}
                      pct={cat.pct}
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      ) : budgetList.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title="Nessun budget configurato"
            description="Aggiungi un budget per categoria o un tetto mensile complessivo usando il form qui sotto."
          />
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={Target}
            title="Nessun movimento questo mese"
            description="Non ci sono transazioni nel mese selezionato, oppure non hai ancora importato movimenti."
          />
        </Card>
      )}

      {/* ── Manager (gestione budget) ──────────────────────────────────────── */}
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-[--ink]">Gestisci budget</h2>
        <p className="text-sm text-[--muted] leading-relaxed">
          Imposta un limite di spesa mensile per categoria o un tetto complessivo.
          I budget si applicano a ogni mese e tengono conto solo delle uscite.
        </p>
        <BudgetsManager budgets={budgetList} categories={categories} />
      </Card>
    </main>
  )
}
