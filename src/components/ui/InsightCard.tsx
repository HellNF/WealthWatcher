// src/components/ui/InsightCard.tsx — Card riusabile per un Insight narrativo.
// Stile "tile icona colorata per severity" già usato in reports/statistiche, qui
// centralizzato per coerenza. Mappa severity → colori/etichetta e icon → componente Lucide.
import Link from 'next/link'
import {
  TrendingUp, Repeat2, AlertCircle, PiggyBank, Calendar, Scale, Coins, ArrowRight,
} from 'lucide-react'
import type { Insight, InsightIcon, InsightSeverity } from '@/lib/insights'
import type { BadgeVariant } from './Badge'
import { Card } from './Card'
import { Badge } from './Badge'
import { cn } from '@/lib/cn'

export const INSIGHT_ICONS: Record<InsightIcon, React.ElementType> = {
  trend: TrendingUp, repeat: Repeat2, alert: AlertCircle,
  piggy: PiggyBank, calendar: Calendar, scale: Scale, coins: Coins,
}

export const INSIGHT_META: Record<InsightSeverity, {
  tile:  string
  badge: BadgeVariant
  label: string
}> = {
  critical:    { tile: 'bg-[--danger-subtle] text-[--danger]',        badge: 'danger',  label: 'Critico'     },
  warn:        { tile: 'bg-[--warning-subtle] text-[--warning-text]',  badge: 'warning', label: 'Attenzione'  },
  opportunity: { tile: 'bg-[--brand-subtle] text-[--brand-text]',      badge: 'gain',    label: 'Opportunità' },
  info:        { tile: 'bg-[--surface-2] text-[--muted]',              badge: 'neutral', label: 'Info'        },
}

interface InsightCardProps {
  insight: Insight
  /** Testo del link quando l'insight ha un href (default: "Approfondisci"). */
  linkLabel?: string
  className?: string
}

export function InsightCard({ insight, linkLabel = 'Approfondisci', className }: InsightCardProps) {
  const meta = INSIGHT_META[insight.severity]
  const Icon = INSIGHT_ICONS[insight.icon]
  return (
    <Card className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg', meta.tile)}>
            <Icon className="size-4" strokeWidth={1.75} aria-hidden />
          </span>
          <h3 className="text-sm font-semibold text-[--ink] text-wrap-balance">{insight.title}</h3>
        </div>
        <Badge variant={meta.badge} className="shrink-0">{meta.label}</Badge>
      </div>

      <p className="text-sm text-[--muted] leading-relaxed">{insight.body}</p>

      <div className="mt-auto flex items-center justify-between gap-3 pt-1">
        {insight.impactLabel ? (
          <p className="text-xs font-medium font-mono tabular-nums text-[--ink] bg-[--surface-2] rounded-md px-2 py-1 w-fit">
            {insight.impactLabel}
          </p>
        ) : <span />}
        {insight.href && (
          <Link
            href={insight.href}
            className="inline-flex items-center gap-1 text-xs font-medium text-[--brand-text] hover:gap-1.5 transition-all shrink-0"
          >
            {linkLabel}
            <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden />
          </Link>
        )}
      </div>
    </Card>
  )
}
