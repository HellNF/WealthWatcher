'use client'

import { Target } from 'lucide-react'
import { ProgressBar, EmptyState } from '@/components/ui'
import type { GoalsWidgetData, WidgetSize } from './types'
import { FitList, plural } from './FitList'
import { fmtEur } from '@/lib/format'

// Massimo di righe; quante se ne vedono davvero lo decide FitList (spazio del widget)
const GOALS_VISIBLE: Record<WidgetSize, number> = { sm: 8, md: 8, lg: 12 }

export function GoalsWidget({ data, size }: { data: GoalsWidgetData; size: WidgetSize }) {
  const { goals, summary } = data

  if (goals.length === 0) {
    return (
      <EmptyState
        className="flex-1 py-6 sm:py-6"
        icon={Target}
        title="Nessun obiettivo"
        description="Crea il tuo primo obiettivo finanziario."
      />
    )
  }

  const completedCount = goals.filter(g => g.completed).length
  const limit = GOALS_VISIBLE[size]

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4">
      {/* KPI row — sempre visibile */}
      <div className="grid grid-cols-2 gap-3 shrink-0">
        <div className="rounded-xl bg-(--surface-2) px-3 py-2.5">
          <p className="text-[10px] font-medium text-(--faint) uppercase tracking-wider mb-0.5">Liquidità libera</p>
          <p className="text-sm font-semibold font-mono tabular-nums text-(--ink)">
            {fmtEur(summary.freeOperatingCashMinor, 0)}
          </p>
        </div>
        <div className="rounded-xl bg-(--surface-2) px-3 py-2.5">
          <p className="text-[10px] font-medium text-(--faint) uppercase tracking-wider mb-0.5">Completati</p>
          <p className="text-sm font-semibold font-mono tabular-nums text-(--ink)">
            {completedCount}
            <span className="text-(--muted) font-normal">/{goals.length}</span>
          </p>
        </div>
      </div>

      {/* Lista obiettivi: quanti entrano nello spazio del widget */}
      {limit > 0 && (
        <FitList
          className="space-y-3"
          more={(n) => plural(n + Math.max(0, goals.length - limit), 'altro obiettivo', 'altri obiettivi')}
        >
          {goals.slice(0, limit).map((g) => {
            const pct = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0
            return (
              <div key={g.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="size-2 rounded-full shrink-0" style={{ background: g.color }} />
                    <span className="text-xs text-(--ink) [overflow-wrap:anywhere]">{g.name}</span>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-(--muted) shrink-0">
                    {pct.toFixed(0)}%
                  </span>
                </div>
                <ProgressBar value={g.current} max={g.target || 1} color={g.color} />
              </div>
            )
          })}
        </FitList>
      )}
    </div>
  )
}
