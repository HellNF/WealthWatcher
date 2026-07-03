'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
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

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
          formatter={(value) => [fmtEur(Number(value)), 'Spesa media']}
          labelFormatter={(label) => `Giorno ${label} del mese`}
          contentStyle={{
            background: colors.tooltipBg,
            border: `1px solid ${colors.tooltipBorder}`,
            borderRadius: 10,
            fontSize: 12,
            boxShadow: '0 4px 12px oklch(0 0 0 / 0.12)',
          }}
        />
        <ReferenceLine y={avg} stroke={colors.ref} strokeDasharray="4 4" />
        <Bar dataKey="avgMinor" radius={[3, 3, 0, 0]} maxBarSize={20}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.avgMinor >= p75 ? colors.barHigh : entry.avgMinor >= avg ? colors.bar : colors.barDim}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
