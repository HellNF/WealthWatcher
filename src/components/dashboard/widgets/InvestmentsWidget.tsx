'use client'

import { useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import { motion, AnimatePresence, LayoutGroup } from 'motion/react'
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { useTheme } from '@/components/providers/ThemeProvider'
import { cn } from '@/lib/cn'
import type { InvestmentsWidgetData, PortfolioItem, SparkPoint, WidgetSize } from './types'

// Palette luce / buio
const PALETTE_LIGHT = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#ec4899']
const PALETTE_DARK  = ['#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f87171', '#22d3ee', '#fb923c', '#f472b6']

function fmtEur(minor: number) {
  return (minor / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
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
}: {
  sparkline: SparkPoint[]
  color:     string
  isDark:    boolean
}) {
  if (sparkline.length < 2) {
    return (
      <p className="text-xs text-[--faint] text-center py-3">
        Storico non ancora disponibile
      </p>
    )
  }

  const tooltipBg     = isDark ? '#1a2421' : '#ffffff'
  const tooltipBorder = isDark ? 'oklch(0.26 0.01 160)' : 'oklch(0.88 0.005 160)'
  const gradId        = `invGrad${color.replace('#', '')}`

  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={sparkline} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis domain={['auto', 'auto']} hide />
        <Tooltip
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
        <Area
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
  canExpand:  boolean
  isDark:     boolean
  onToggle:   () => void
}

function PortfolioRow({ pf, color, isSelected, canExpand, isDark, onToggle }: RowProps) {
  const pct   = calcPct(pf.sparkline)
  const isPos = pct === null || pct >= 0

  const pctColor = isPos
    ? (isDark ? '#34d399' : '#059669')
    : (isDark ? '#f87171' : '#dc2626')

  const pctBg = isPos
    ? (isDark ? 'oklch(0.22 0.06 160)' : 'oklch(0.94 0.04 160)')
    : (isDark ? 'oklch(0.22 0.06 15)'  : 'oklch(0.96 0.03 15)')

  return (
    <motion.div key={pf.id} layout layoutId={`inv-row-${pf.id}`} transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
      {/* Riga principale */}
      <button
        onClick={canExpand ? onToggle : undefined}
        className={cn(
          'w-full flex items-center gap-2.5 px-4 sm:px-5 py-2 text-left transition-colors duration-100',
          canExpand && 'hover:bg-[--surface-2] cursor-pointer',
          !canExpand && 'cursor-default',
          isSelected && 'bg-[--surface-2]',
        )}
      >
        {/* Avatar */}
        <div
          className="size-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold text-white"
          style={{ background: color }}
        >
          {pf.name[0]?.toUpperCase()}
        </div>

        {/* Nome */}
        <span className="flex-1 min-w-0 text-xs font-medium text-[--ink] truncate">
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
        <span className="text-xs font-mono tabular-nums text-[--ink] shrink-0">
          {pf.eurMinor !== null ? fmtEur(pf.eurMinor) : '—'}
        </span>
      </button>

      {/* Grafico — appare solo sulla riga selezionata */}
      <AnimatePresence initial={false}>
        {isSelected && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-3 pt-1">
              <ChartStrip sparkline={pf.sparkline} color={color} isDark={isDark} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
        icon={TrendingUp}
        title="Nessun portafoglio"
        description="Aggiungi il tuo primo portafoglio d'investimento."
      />
    )
  }

  const canExpand = size !== 'sm'

  function toggle(id: number) {
    setSelectedId(prev => prev === id ? null : id)
  }

  // Il portfolio selezionato sale in cima; gli altri seguono nell'ordine originale
  const selected = portfolios.find(p => p.id === selectedId)
  const rest     = portfolios.filter(p => p.id !== selectedId)
  const sorted   = canExpand && selected ? [selected, ...rest] : portfolios

  // In SM/MD si mostrano al massimo 3 righe per stare nell'altezza fissa del widget
  const limit      = size === 'lg' ? portfolios.length : 3
  const displayed  = sorted.slice(0, limit)
  const hiddenCount = sorted.length - displayed.length

  return (
    <div>
      {/* Totale */}
      <div className="mb-3">
        <p className="text-[10px] font-medium text-[--faint] uppercase tracking-wider mb-0.5">
          Totale investito
        </p>
        <p className="text-xl font-bold font-mono tabular-nums text-[--ink] leading-none">
          {fmtEurCompact(totalInvestmentsMinor)}
        </p>
      </div>

      {/* Lista portafogli con animazione di riordino */}
      <LayoutGroup>
        <div className="divide-y divide-[--border] -mx-4 sm:-mx-5">
          {displayed.map((pf) => (
            <PortfolioRow
              key={pf.id}
              pf={pf}
              color={colorOf.get(pf.id)!}
              isSelected={canExpand && pf.id === selectedId}
              canExpand={canExpand}
              isDark={isDark}
              onToggle={() => toggle(pf.id)}
            />
          ))}
          {hiddenCount > 0 && (
            <p className="px-4 sm:px-5 py-2 text-[10px] text-[--faint]">
              +{hiddenCount} altri portafogli
            </p>
          )}
        </div>
      </LayoutGroup>
    </div>
  )
}
