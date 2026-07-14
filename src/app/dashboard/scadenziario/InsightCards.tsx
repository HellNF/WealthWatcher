'use client'

import Link from 'next/link'
import {
  TrendingUp, Repeat2, AlertCircle, PiggyBank, Calendar, Scale, Coins, ArrowRight,
} from 'lucide-react'
import { Card, Badge } from '@/components/ui'
import type { Insight, InsightIcon, InsightSeverity } from '@/lib/insights'

const INSIGHT_ICONS: Record<InsightIcon, React.ElementType> = {
  trend: TrendingUp, repeat: Repeat2, alert: AlertCircle,
  piggy: PiggyBank, calendar: Calendar, scale: Scale, coins: Coins,
}

const SEVERITY_META: Record<InsightSeverity, {
  tile: string
  badge: 'danger' | 'warning' | 'gain' | 'neutral'
  label: string
}> = {
  critical:    { tile: 'bg-[--danger-subtle] text-[--danger]',        badge: 'danger',  label: 'Critico'     },
  warn:        { tile: 'bg-[--warning-subtle] text-[--warning-text]', badge: 'warning', label: 'Attenzione'  },
  opportunity: { tile: 'bg-[--brand-subtle] text-[--brand-text]',     badge: 'gain',    label: 'Opportunità' },
  info:        { tile: 'bg-[--surface-2] text-[--muted]',             badge: 'neutral', label: 'Info'        },
}

export default function InsightCards({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {insights.map((ins) => {
        const meta = SEVERITY_META[ins.severity]
        const Icon = INSIGHT_ICONS[ins.icon] ?? AlertCircle
        return (
          <Card key={ins.id} className="space-y-2.5" hoverable={!!ins.href}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${meta.tile}`}>
                  <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                </span>
                <h3 className="text-sm font-semibold text-[--ink] leading-snug">{ins.title}</h3>
              </div>
              <Badge variant={meta.badge} className="shrink-0">{meta.label}</Badge>
            </div>
            <p className="text-sm text-[--muted] leading-relaxed">{ins.body}</p>
            <div className="flex items-center justify-between gap-3 pt-0.5">
              {ins.impactLabel ? (
                <p className="text-xs font-medium font-mono tabular-nums text-[--ink] bg-[--surface-2] rounded-md px-2 py-1 w-fit">
                  {ins.impactLabel}
                </p>
              ) : <span />}
              {ins.href && (
                <Link
                  href={ins.href}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[--brand-text] hover:gap-1.5 transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring] rounded"
                >
                  Vai <ArrowRight className="size-3.5" strokeWidth={2} />
                </Link>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
