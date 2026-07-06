'use client'

import { Target } from 'lucide-react'
import { ProgressBar, EmptyState } from '@/components/ui'
import type { GoalsWidgetData, WidgetSize } from './types'

function fmtEur(minor: number) {
  return (minor / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

const GOALS_VISIBLE: Record<WidgetSize, number> = { sm: 0, md: 4, lg: 8 }

export function GoalsWidget({ data, size }: { data: GoalsWidgetData; size: WidgetSize }) {
  const { goals, summary } = data

  if (goals.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title="Nessun obiettivo"
        description="Crea il tuo primo obiettivo finanziario."
      />
    )
  }

  const completedCount = goals.filter(g => g.completed).length
  const limit = GOALS_VISIBLE[size]

  return (
    <div className="space-y-4">
      {/* KPI row — sempre visibile */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[--surface-2] px-3 py-2.5">
          <p className="text-[10px] font-medium text-[--faint] uppercase tracking-wider mb-0.5">Liquidità libera</p>
          <p className="text-sm font-semibold font-mono tabular-nums text-[--ink]">
            {fmtEur(summary.freeOperatingCashMinor)}
          </p>
        </div>
        <div className="rounded-xl bg-[--surface-2] px-3 py-2.5">
          <p className="text-[10px] font-medium text-[--faint] uppercase tracking-wider mb-0.5">Completati</p>
          <p className="text-sm font-semibold font-mono tabular-nums text-[--ink]">
            {completedCount}
            <span className="text-[--muted] font-normal">/{goals.length}</span>
          </p>
        </div>
      </div>

      {/* Goals list — nascosta in sm */}
      {limit > 0 && (
        <div className="space-y-3">
          {goals.slice(0, limit).map((g) => {
            const pct = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0
            return (
              <div key={g.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="size-2 rounded-full shrink-0" style={{ background: g.color }} />
                    <span className="text-xs text-[--ink] truncate">{g.name}</span>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-[--muted] shrink-0">
                    {pct.toFixed(0)}%
                  </span>
                </div>
                <ProgressBar value={g.current} max={g.target || 1} color={g.color} />
              </div>
            )
          })}
          {goals.length > limit && (
            <p className="text-xs text-[--faint] text-center">+{goals.length - limit} altri obiettivi</p>
          )}
        </div>
      )}
    </div>
  )
}
