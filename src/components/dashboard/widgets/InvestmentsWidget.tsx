'use client'

import { useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { useTheme } from '@/components/providers/ThemeProvider'
import { cn } from '@/lib/cn'
import type { InvestmentsWidgetData, PortfolioItem, SparkPoint, WidgetSize } from './types'
import { FitList, plural } from './FitList'

// Palette luce / buio
const PALETTE_LIGHT = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#ec4899']
const PALETTE_DARK  = ['#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f87171', '#22d3ee', '#fb923c', '#f472b6']

function fmtEur(minor: number) {
  return (minor / 100).toLocaleString('it-IT', { style: 'currency', useGrouping: 'always', currency: 'EUR', maximumFractionDigits: 0 })
}

function fmtEurCompact(minor: number) {
  const v = minor / 100
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}M €`
  if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toLocaleString('it-IT',     { maximumFractionDigits: 1 })}k €`
  return fmtEur(minor)
}

function calcPct(sparkline: SparkPoint[]): number | null {
  const first = sparkline[0]?.value
  const last  = sparkline.at(-1)?.value
  if (first == null || last == null || first === 0) return null
  return ((last - first) / Math.abs(first)) * 100
}

// ── Grafico striscia (largo, poco alto) ──────────────────────────────────────

function ChartStrip({
  sparkline,
  color,
  isDark,
  height,
}: {
  sparkline: SparkPoint[]
  color:     string
  isDark:    boolean
  height:    number
}) {
  if (sparkline.length < 2) {
    return (
      <p className="text-xs text-(--faint) flex items-center justify-center" style={{ height }}>
        Storico non ancora disponibile
      </p>
    )
  }

  const tooltipBg     = isDark ? '#1a2421' : '#ffffff'
  const tooltipBorder = isDark ? 'oklch(0.26 0.01 160)' : 'oklch(0.88 0.005 160)'
  const gradId        = `invGrad${color.replace('#', '')}`

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={sparkline} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis domain={['auto', 'auto']} hide />
        <Tooltip isAnimationActive={false}
          formatter={(v) => [fmtEur(Number(v)), 'Valore']}
          labelFormatter={(l) => String(l)}
          contentStyle={{
            background:   tooltipBg,
            border:       `1px solid ${tooltipBorder}`,
            borderRadius: 8,
            fontSize:     11,
          }}
          itemStyle={{ color }}
          cursor={{ stroke: tooltipBorder, strokeWidth: 1 }}
        />
        <Area isAnimationActive={false}
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradId})`}
          dot={false}
          activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Riga portafoglio ──────────────────────────────────────────────────────────

interface RowProps {
  pf:         PortfolioItem
  color:      string
  isSelected: boolean
  canSelect:  boolean
  isDark:     boolean
  onSelect:   () => void
}

function PortfolioRow({ pf, color, isSelected, canSelect, isDark, onSelect }: RowProps) {
  const pct   = calcPct(pf.sparkline)
  const isPos = pct === null || pct >= 0

  const pctColor = isPos
    ? (isDark ? '#34d399' : '#059669')
    : (isDark ? '#f87171' : '#dc2626')

  const pctBg = isPos
    ? (isDark ? 'oklch(0.22 0.06 160)' : 'oklch(0.94 0.04 160)')
    : (isDark ? 'oklch(0.22 0.06 15)'  : 'oklch(0.96 0.03 15)')

  const content = (
    <>
      {/* Avatar */}
      <span
        className="size-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold text-white"
        style={{ background: color }}
        aria-hidden
      >
        {pf.name[0]?.toUpperCase()}
      </span>

      {/* Nome */}
      <span className="flex-1 min-w-0 text-xs font-medium text-(--ink) [overflow-wrap:anywhere]">
        {pf.name}
      </span>

      {/* Badge % */}
      {pct !== null && (
        <span
          className="text-[10px] font-semibold tabular-nums shrink-0 px-1.5 py-0.5 rounded-full"
          style={{ color: pctColor, background: pctBg }}
        >
          {isPos ? '+' : ''}{pct.toFixed(2)}%
        </span>
      )}

      {/* Valore */}
      <span className="text-xs font-mono tabular-nums text-(--ink) shrink-0">
        {pf.eurMinor !== null ? fmtEur(pf.eurMinor) : '—'}
      </span>
    </>
  )

  const rowClass = 'w-full flex items-center gap-2.5 px-4 sm:px-5 py-2 text-left'
  if (!canSelect) return <div className={rowClass}>{content}</div>

  // Selezionare non sposta né apre righe: cambia solo il grafico sopra la lista
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={cn(
        rowClass,
        'transition-colors duration-150 ease-out hover:bg-(--surface-2) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--ring)',
        isSelected && 'bg-(--surface-2)',
      )}
    >
      {content}
    </button>
  )
}

// ── Widget principale ─────────────────────────────────────────────────────────

export function InvestmentsWidget({
  data,
  size,
}: {
  data: InvestmentsWidgetData
  size: WidgetSize
}) {
  const { portfolios, totalInvestmentsMinor } = data
  const { resolvedTheme } = useTheme()
  const isDark  = resolvedTheme === 'dark'
  const palette = isDark ? PALETTE_DARK : PALETTE_LIGHT

  // Mappa stabile colore → portfolio (basata sull'ordine originale)
  const colorOf = new Map(portfolios.map((pf, i) => [pf.id, palette[i % palette.length]]))

  const [selectedId, setSelectedId] = useState<number | null>(portfolios[0]?.id ?? null)

  if (portfolios.length === 0) {
    return (
      <EmptyState
        className="flex-1 py-6 sm:py-6"
        icon={TrendingUp}
        title="Nessun portafoglio"
        description="Aggiungi il tuo primo portafoglio d'investimento."
      />
    )
  }

  // In S il widget è un riepilogo: niente grafico, righe non selezionabili
  const canSelect = size !== 'sm'
  const selected  = portfolios.find(p => p.id === selectedId) ?? portfolios[0]

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Totale */}
      <div className="mb-3 shrink-0">
        <p className="text-[10px] font-medium text-(--faint) uppercase tracking-wider mb-0.5">
          Totale investito
        </p>
        <p className="text-xl font-bold font-mono tabular-nums text-(--ink) leading-none">
          {fmtEurCompact(totalInvestmentsMinor)}
        </p>
      </div>

      {/* Andamento del portafoglio selezionato: spazio fisso, le righe sotto non si muovono */}
      {canSelect && (
        <div className="shrink-0 mb-2">
          <ChartStrip
            sparkline={selected.sparkline}
            color={colorOf.get(selected.id)!}
            isDark={isDark}
            height={size === 'lg' ? 72 : 44}
          />
        </div>
      )}

      <FitList
        className="divide-y divide-(--border) -mx-4 sm:-mx-5"
        more={(n) => plural(n, 'altro portafoglio', 'altri portafogli')}
      >
        {portfolios.map((pf) => (
          <PortfolioRow
            key={pf.id}
            pf={pf}
            color={colorOf.get(pf.id)!}
            isSelected={canSelect && pf.id === selected.id}
            canSelect={canSelect}
            isDark={isDark}
            onSelect={() => setSelectedId(pf.id)}
          />
        ))}
      </FitList>
    </div>
  )
}
