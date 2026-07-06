'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { fetchHistoryAction } from './actions'
import type { PricePoint } from '@/lib/prices/yahoo'
import { useTheme } from '@/components/providers/ThemeProvider'

interface Props {
  symbol:   string
  name:     string
  currency: string
}

const PERIODS = [
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1A' },
  { key: '5y', label: '5A' },
] as const

function shortDate(iso: string, period: string): string {
  const [y, m, d] = iso.split('-')
  if (period === '5y' || period === '1y') return `${m}/${y.slice(2)}`
  return `${d}/${m}`
}

function formatPrice(value: number, currency: string): string {
  return value.toLocaleString('it-IT', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

export default function InstrumentPriceChart({ symbol, name, currency }: Props) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [period, setPeriod]          = useState<string>('3m')
  const [data, setData]              = useState<PricePoint[]>([])
  const [isPending, startTransition] = useTransition()
  const [hasData, setHasData]        = useState<boolean | null>(null) // null = mai caricato
  const [retryKey, setRetryKey]      = useState(0)

  useEffect(() => {
    // Svuota subito i dati precedenti: il periodo è cambiato, non vogliamo
    // mostrare dati di un periodo diverso mentre il nuovo carica.
    setData([])
    setHasData(null)
    startTransition(async () => {
      const rows = await fetchHistoryAction(symbol, period)
      if (rows.length > 1) {
        setData(rows)
        setHasData(true)
      } else {
        setHasData(false)
      }
    })
  }, [symbol, period, retryKey])

  // Calcola delta % dal primo all'ultimo punto
  const first = data[0]?.close
  const last  = data.at(-1)?.close
  const deltaSign = first && last ? (last > first ? 1 : last < first ? -1 : 0) : 0

  const colors = isDark
    ? {
        brand:         deltaSign >= 0 ? '#34d399' : '#f87171',
        grid:          'oklch(0.26 0.01 160)',
        axis:          'oklch(0.42 0.01 160)',
        tooltipBg:     '#1a2421',
        tooltipBorder: 'oklch(0.26 0.01 160)',
        tooltipLabel:  'oklch(0.62 0.01 160)',
      }
    : {
        brand:         deltaSign >= 0 ? '#059669' : '#dc2626',
        grid:          'oklch(0.88 0.005 160)',
        axis:          'oklch(0.65 0.008 160)',
        tooltipBg:     '#ffffff',
        tooltipBorder: 'oklch(0.88 0.005 160)',
        tooltipLabel:  'oklch(0.45 0.01 160)',
      }

  const chartData = data.map((p) => ({ date: shortDate(p.date, period), close: p.close }))

  const deltaPct = first && last && first !== 0
    ? (((last - first) / first) * 100).toFixed(2)
    : null

  return (
    <div className="space-y-3">
      {/* Header: nome + delta */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium text-[--ink] leading-tight">{name}</p>
          <p className="text-xs text-[--muted]">{symbol} · {currency}</p>
        </div>
        <div className="flex items-center gap-2">
          {deltaPct !== null && (
            <span
              className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full"
              style={{
                background: deltaSign >= 0
                  ? isDark ? 'oklch(0.22 0.06 160)' : 'oklch(0.94 0.04 160)'
                  : isDark ? 'oklch(0.22 0.06 15)'  : 'oklch(0.96 0.03 15)',
                color: colors.brand,
              }}
            >
              {deltaSign >= 0 ? '+' : ''}{deltaPct}%
            </span>
          )}
          {/* Period selector */}
          <div className="flex rounded-lg border border-[--border] overflow-hidden">
            {PERIODS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className="px-2.5 py-1 text-xs font-medium transition-colors duration-100"
                style={{
                  background: period === key
                    ? (isDark ? 'oklch(0.22 0.06 160)' : 'oklch(0.92 0.05 160)')
                    : 'transparent',
                  color: period === key ? colors.brand : isDark ? 'oklch(0.55 0.01 160)' : 'oklch(0.55 0.01 160)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative" style={{ height: 140 }}>
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-[--surface]/60 rounded-lg z-10">
            <span className="text-xs text-[--muted]">Caricamento…</span>
          </div>
        )}
        {hasData === false && !isPending ? (
          <div className="h-full flex flex-col items-center justify-center gap-2">
            <span className="text-xs text-[--faint]">Dati non disponibili per questo strumento</span>
            <button
              onClick={() => { setHasData(null); setRetryKey(k => k + 1) }}
              className="text-xs text-[--brand-text] hover:underline"
            >
              Riprova
            </button>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={colors.brand} stopOpacity={isDark ? 0.25 : 0.15} />
                  <stop offset="100%" stopColor={colors.brand} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: colors.axis, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={['auto', 'auto']}
                tickFormatter={(v) => v.toLocaleString('it-IT', { maximumFractionDigits: 2 })}
                tick={{ fill: colors.axis, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={64}
              />
              <Tooltip
                formatter={(value) => [formatPrice(Number(value), currency), 'Prezzo']}
                labelFormatter={(label) => `Data: ${String(label)}`}
                contentStyle={{
                  background:   colors.tooltipBg,
                  border:       `1px solid ${colors.tooltipBorder}`,
                  borderRadius: 10,
                  fontSize:     12,
                  boxShadow:    '0 4px 12px oklch(0 0 0 / 0.12)',
                }}
                itemStyle={{ color: colors.brand }}
                labelStyle={{ color: colors.tooltipLabel }}
                cursor={{ stroke: colors.grid, strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={colors.brand}
                strokeWidth={1.5}
                fill={`url(#grad-${symbol})`}
                dot={false}
                activeDot={{ r: 3, fill: colors.brand, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
