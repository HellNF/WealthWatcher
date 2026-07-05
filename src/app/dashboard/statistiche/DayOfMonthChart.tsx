'use client'

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, Legend,
} from 'recharts'
import type { DaySpendingPoint } from '@/lib/analytics'
import { useTheme } from '@/components/providers/ThemeProvider'

interface Props {
  data: DaySpendingPoint[]
}

function fmtEur(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
}

function computeEma(values: number[], period = 5): (number | null)[] {
  const k = 2 / (period + 1)
  const result: (number | null)[] = []
  let ema: number | null = null
  for (const v of values) {
    ema = ema === null ? v : v * k + ema * (1 - k)
    result.push(ema)
  }
  return result
}

export default function DayOfMonthChart({ data }: Props) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  if (data.length < 5) {
    return (
      <p className="text-sm text-[--muted] py-6 text-center">
        Importa almeno 2 mesi di movimenti per visualizzare i pattern per giorno del mese.
      </p>
    )
  }

  const colors = isDark
    ? {
        grid:     'oklch(0.26 0.01 160)',
        axis:     'oklch(0.42 0.01 160)',
        bar:      '#34d399',
        barHigh:  '#f87171',
        barDim:   '#34d39944',
        ref:      'oklch(0.42 0.01 160)',
        trend:    '#a78bfa',
        tooltipBg:     '#1a2421',
        tooltipBorder: 'oklch(0.26 0.01 160)',
      }
    : {
        grid:     'oklch(0.88 0.005 160)',
        axis:     'oklch(0.65 0.008 160)',
        bar:      '#059669',
        barHigh:  '#dc2626',
        barDim:   '#05966940',
        ref:      'oklch(0.65 0.008 160)',
        trend:    '#7c3aed',
        tooltipBg:     '#ffffff',
        tooltipBorder: 'oklch(0.88 0.005 160)',
      }

  const avg = data.length > 0
    ? data.reduce((s, d) => s + d.avgMinor, 0) / data.length
    : 0
  const p75 = (() => {
    const sorted = [...data].sort((a, b) => a.avgMinor - b.avgMinor)
    return sorted[Math.floor(sorted.length * 0.75)]?.avgMinor ?? 0
  })()

  const emaValues = computeEma(data.map((d) => d.avgMinor))
  const chartData = data.map((d, i) => ({
    ...d,
    'Media Mobile Trend': emaValues[i],
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: colors.axis, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={2}
        />
        <YAxis
          tickFormatter={(v) => fmtEur(v)}
          tick={{ fill: colors.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={80}
        />
        <Tooltip
          formatter={(value, name) => [fmtEur(Number(value)), name === 'avgMinor' ? 'Spesa media' : String(name)]}
          labelFormatter={(label) => `Giorno ${label} del mese`}
          contentStyle={{
            background: colors.tooltipBg,
            border: `1px solid ${colors.tooltipBorder}`,
            borderRadius: 10,
            fontSize: 12,
            boxShadow: '0 4px 12px oklch(0 0 0 / 0.12)',
          }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
        <ReferenceLine y={avg} stroke={colors.ref} strokeDasharray="4 4" />
        <Bar dataKey="avgMinor" name="Spesa giornaliera" radius={[3, 3, 0, 0]} maxBarSize={20} legendType="none">
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.avgMinor >= p75 ? colors.barHigh : entry.avgMinor >= avg ? colors.bar : colors.barDim}
            />
          ))}
        </Bar>
        <Line
          type="monotone"
          dataKey="Media Mobile Trend"
          stroke={colors.trend}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
