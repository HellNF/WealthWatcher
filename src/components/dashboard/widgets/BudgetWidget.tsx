'use client'

import { Wallet } from 'lucide-react'
import { ProgressBar, EmptyState } from '@/components/ui'
import type { BudgetWidgetData, WidgetSize } from './types'

function fmtEur(minor: number) {
  return (minor / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

const MONTHS_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

function monthLabel(ym: string) {
  const [, m] = ym.split('-')
  return MONTHS_IT[parseInt(m, 10) - 1] ?? ym
}

function barColor(pct: number | null): string {
  if (pct === null) return 'var(--brand)'
  if (pct >= 100) return 'var(--danger)'
  if (pct >= 80)  return 'var(--warning)'
  return 'var(--brand)'
}

const CATS_VISIBLE: Record<WidgetSize, number> = { sm: 0, md: 2, lg: 4 }

export function BudgetWidget({ data, size }: { data: BudgetWidgetData; size: WidgetSize }) {
  const { month, total, topCategories, daysRemainingInMonth } = data
  const hasLimit = total.limitMinor !== null

  if (!hasLimit && topCategories.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Nessun budget configurato"
        description="Imposta un limite mensile per iniziare il tracciamento."
      />
    )
  }

  const dailyRemaining = hasLimit && daysRemainingInMonth > 0
    ? (total.limitMinor! - total.spentMinor) / daysRemainingInMonth
    : null

  const catsLimit = CATS_VISIBLE[size]

  return (
    <div className="space-y-4">
      {/* Mese + totale */}
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-medium text-[--faint] uppercase tracking-wider mb-0.5">
            {monthLabel(month)}
          </p>
          <p className="text-sm font-mono tabular-nums text-[--ink]">
            <span className="font-semibold">{fmtEur(total.spentMinor)}</span>
            {hasLimit && (
              <span className="text-[--muted] font-normal"> / {fmtEur(total.limitMinor!)}</span>
            )}
          </p>
        </div>
        {dailyRemaining !== null && (
          <div className="text-right">
            <p className="text-[10px] text-[--faint] mb-0.5">Al giorno ({daysRemainingInMonth}gg)</p>
            <p className={`text-sm font-mono tabular-nums font-semibold ${dailyRemaining < 0 ? 'text-[--danger]' : 'text-[--ink]'}`}>
              {fmtEur(Math.max(0, dailyRemaining))}
            </p>
          </div>
        )}
      </div>

      {/* Barra totale */}
      {hasLimit && (
        <ProgressBar value={total.spentMinor} max={total.limitMinor!} color={barColor(total.pct)} />
      )}

      {/* Categorie — visibili solo in md / lg */}
      {catsLimit > 0 && topCategories.length > 0 && (
        <div className="space-y-2.5">
          {topCategories.slice(0, catsLimit).map((cat, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ background: cat.color ?? 'var(--muted)' }}
                  />
                  <span className="text-xs text-[--ink] truncate">
                    {cat.name ?? 'Senza categoria'}
                  </span>
                </div>
                <span className="text-xs font-mono tabular-nums text-[--muted] shrink-0">
                  {fmtEur(cat.spentMinor)} / {fmtEur(cat.limitMinor)}
                </span>
              </div>
              <ProgressBar value={cat.spentMinor} max={cat.limitMinor} color={barColor(cat.pct)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
