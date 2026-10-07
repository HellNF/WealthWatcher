import { requireUser } from '@/lib/dal'
import { listBudgets, budgetStatus } from '@/lib/budgets'
import { listAllCategories } from '@/lib/transactions'
import { availableMonths } from '@/lib/reports'
import { Target } from 'lucide-react'
import {
  Card, EmptyState, PageHeader, HeroShell, Eyebrow, StickyBar, PAGE_SHELL,
} from '@/components/ui'
import MonthNav from '../reports/MonthNav'
import BudgetsManager from './BudgetsManager'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ month?: string }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS_IT = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre']
function monthLabel(m: string): string {
  const [y, mo] = m.split('-')
  return `${MONTHS_IT[parseInt(mo, 10) - 1]} ${y}`
}

function fmtEur(minor: number, decimals = 2): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency', useGrouping: 'always', currency: 'EUR',
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  })
}

/** Colore di stato: neutro finché c'è margine, ambra vicino al limite, rosso oltre. */
function barColor(pct: number): string {
  if (pct >= 100) return 'var(--danger)'
  if (pct >= 80)  return 'var(--warning)'
  return 'var(--ink)'
}
function pctTone(pct: number): string {
  if (pct >= 100) return 'text-(--danger-text)'
  if (pct >= 80)  return 'text-(--warning-text)'
  return 'text-(--muted)'
}

function Bar({ pct, className = 'h-2' }: { pct: number; className?: string }) {
  return (
    <div className={`${className} bg-(--surface-2) rounded-full overflow-hidden`} aria-hidden>
      <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: barColor(pct) }} />
    </div>
  )
}

const KEY = 'text-2xl sm:text-3xl font-extrabold font-display tabular-nums leading-none tracking-[-0.02em] text-(--ink)'

// ── Pagina ────────────────────────────────────────────────────────────────────

export default async function BudgetsPage({ searchParams }: Props) {
  const { month: monthParam } = await searchParams
  const user       = await requireUser()
  const budgetList = listBudgets(user.id)
  const categories = listAllCategories()

  // Mese corrente come default
  const now      = new Date()
  const today    = now.toISOString().slice(0, 7) // YYYY-MM
  const months   = availableMonths(user.id)
  const month    = monthParam !== undefined && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : (months[0] ?? today)
  const status   = budgetList.length > 0 ? budgetStatus(user.id, month) : null

  const hasCategoryBudgets = status !== null && status.perCategory.length > 0
  const hasTotalBudget     = status !== null && status.total.limit_minor !== null
  const hasStatus          = status !== null && (hasTotalBudget || hasCategoryBudgets)

  // ── Sintesi dell'hero: tetto complessivo se c'è, altrimenti somma delle categorie
  const limitMinor = !status ? 0
    : hasTotalBudget ? status.total.limit_minor!
    : status.perCategory.reduce((s, c) => s + c.limit_minor, 0)
  const spentMinor = !status ? 0
    : hasTotalBudget ? status.total.spent_minor
    : status.perCategory.reduce((s, c) => s + c.spent_minor, 0)
  const remainingMinor = limitMinor - spentMinor
  const pct            = limitMinor > 0 ? Math.round((spentMinor / limitMinor) * 100) : 0
  const overCount      = status ? status.perCategory.filter((c) => c.pct >= 100).length : 0

  const isCurrentMonth = month === today
  const lastDay        = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeft       = isCurrentMonth ? Math.max(1, lastDay - now.getDate() + 1) : 0

  const monthNav = months.length > 0
    ? <MonthNav basePath="/dashboard/budgets" months={months.includes(month) ? months : [month, ...months]} month={month} accounts={[]} accountId={null} />
    : undefined

  return (
    <>
    {hasStatus && (
      <StickyBar watchId="budget-remaining" interactive>
        <span className="text-sm font-medium text-(--ink)">Budget · {monthLabel(month)}</span>
        <span className="text-sm text-(--muted)">
          {remainingMinor >= 0 ? 'Rimangono' : 'Sforato di'}{' '}
          <span className={`font-mono tabular-nums font-semibold ${remainingMinor < 0 ? 'text-(--danger-text)' : 'text-(--ink)'}`}>
            {fmtEur(Math.abs(remainingMinor))}
          </span>
        </span>
        {months.length > 0 && (
          <div className="ml-auto">
            <MonthNav compact basePath="/dashboard/budgets" months={months} month={month} accounts={[]} accountId={null} />
          </div>
        )}
      </StickyBar>
    )}
    <main className={`${PAGE_SHELL} space-y-8`}>
      <PageHeader
        breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Budget' }]}
        title={`Budget di ${monthLabel(month)}`}
        description="Limiti di spesa mensili, per categoria o complessivi, confrontati con le uscite reali."
        actions={monthNav}
      />

      {/* ── Hero: quanto mi resta da spendere questo mese ─────────────────── */}
      {hasStatus ? (
        <HeroShell innerClassName="grid gap-x-14 gap-y-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end p-6 sm:p-8">
          <div className="space-y-5 min-w-0">
            <Eyebrow>{remainingMinor >= 0 ? 'Ancora disponibile' : 'Budget sforato'}</Eyebrow>
            <p
              id="budget-remaining"
              className={`text-5xl sm:text-6xl font-extrabold font-display tabular-nums leading-none tracking-[-0.03em] ${remainingMinor < 0 ? 'text-(--danger-text)' : 'text-(--ink)'}`}
            >
              {remainingMinor < 0 ? '−' : ''}{fmtEur(Math.abs(remainingMinor))}
            </p>
            <div className="space-y-2 max-w-2xl">
              <Bar pct={pct} className="h-2.5" />
              <p className="text-sm text-(--muted)">
                Speso <span className="font-mono tabular-nums text-(--ink)">{fmtEur(spentMinor)}</span> su{' '}
                <span className="font-mono tabular-nums text-(--ink)">{fmtEur(limitMinor)}</span>
                {hasTotalBudget ? ' di tetto mensile' : ` nelle ${status!.perCategory.length === 1 ? 'categoria' : 'categorie'} con budget`}
                {' '}(<span className={`font-mono tabular-nums ${pctTone(pct)}`}>{pct}%</span>).
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-10 gap-y-6 border-t border-(--border) pt-5 xl:border-t-0 xl:pt-0 xl:border-l xl:pl-14">
            <div className="space-y-1.5">
              <dt className="text-xs font-medium text-(--muted)">{isCurrentMonth ? 'Al giorno, fino a fine mese' : 'Speso nel mese'}</dt>
              <dd className={KEY}>
                {isCurrentMonth ? fmtEur(Math.max(0, Math.round(remainingMinor / daysLeft))) : fmtEur(spentMinor, 0)}
              </dd>
              <dd className="text-xs text-(--muted)">
                {isCurrentMonth ? `${daysLeft} ${daysLeft === 1 ? 'giorno rimasto' : 'giorni rimasti'}` : 'mese chiuso'}
              </dd>
            </div>
            <div className="space-y-1.5">
              <dt className="text-xs font-medium text-(--muted)">Categorie oltre il limite</dt>
              <dd className={`${KEY} ${overCount > 0 ? '!text-(--danger-text)' : ''}`}>
                {overCount} di {status!.perCategory.length}
              </dd>
            </div>
            <div className="space-y-1.5">
              <dt className="text-xs font-medium text-(--muted)">Limite del mese</dt>
              <dd className={KEY}>{fmtEur(limitMinor, 0)}</dd>
            </div>
          </dl>
        </HeroShell>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_30rem] gap-x-8 gap-y-8 xl:items-stretch">
        {/* ── Stato del mese, categoria per categoria ─────────────────────── */}
        {hasStatus && hasCategoryBudgets ? (
          <Card className="space-y-4">
            <h2 className="text-sm font-semibold text-(--ink)">Per categoria</h2>
            <ul className="divide-y divide-(--border)">
              {status!.perCategory.map((cat, i) => (
                <li key={i} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                  <div className="flex items-baseline gap-2.5">
                    {cat.color && <span className="size-2.5 rounded-full shrink-0 self-center" style={{ background: cat.color }} aria-hidden />}
                    <span className="text-sm font-medium text-(--ink) truncate">{cat.category_name ?? 'Senza categoria'}</span>
                    <span className="ml-auto shrink-0 text-sm font-mono tabular-nums text-(--ink)">
                      {fmtEur(cat.spent_minor)} <span className="text-(--muted)">/ {fmtEur(cat.limit_minor)}</span>
                    </span>
                  </div>
                  <Bar pct={cat.pct} />
                  <p className="flex justify-between gap-3 text-xs text-(--muted)">
                    <span className={cat.pct >= 100 ? 'text-(--danger-text) font-medium' : ''}>
                      {cat.pct >= 100
                        ? <>Sforato di <span className="font-mono tabular-nums">{fmtEur(cat.spent_minor - cat.limit_minor)}</span></>
                        : <><span className="font-mono tabular-nums">{fmtEur(cat.limit_minor - cat.spent_minor)}</span> rimanenti</>}
                    </span>
                    <span className={`font-mono tabular-nums ${pctTone(cat.pct)}`}>{cat.pct}%</span>
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card className="flex items-center justify-center">
            <EmptyState
              icon={Target}
              title={budgetList.length === 0 ? 'Nessun budget configurato'
                : hasStatus ? 'Nessun budget per categoria'
                : `Nessun movimento a ${monthLabel(month)}`}
              description={budgetList.length === 0
                ? 'Imposta un limite per categoria o un tetto mensile complessivo dal riquadro accanto: da quel momento ogni mese viene confrontato con il limite.'
                : hasStatus
                  ? 'Hai solo un tetto complessivo. Aggiungi un limite per categoria per vedere dove si concentra la spesa.'
                  : 'Non ci sono transazioni nel mese selezionato. Scegli un altro mese o importa i movimenti.'}
            />
          </Card>
        )}

        {/* ── Gestione dei limiti ─────────────────────────────────────────── */}
        <Card className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-(--ink)">I tuoi limiti</h2>
            <p className="text-xs text-(--muted) leading-relaxed">
              Valgono per ogni mese e contano solo le uscite.
            </p>
          </div>
          <BudgetsManager budgets={budgetList} categories={categories} />
        </Card>
      </div>
    </main>
    </>
  )
}
