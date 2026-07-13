'use client'

import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { MonthPacing } from '@/lib/spendingInsights'
import { useTheme } from '@/components/providers/ThemeProvider'

interface Props {
  data: MonthPacing
}

function fmtEur(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
}

/**
 * Cumulata di spesa del mese corrente (linea piena) contro il mese tipico
 * (area attenuata), con proiezione tratteggiata fino a fine mese.
 */
export default function PacingChart({ data }: Props) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const colors = isDark
    ? {
        grid:    'oklch(0.26 0.01 160)',
        axis:    'oklch(0.42 0.01 160)',
        typical: 'oklch(0.42 0.01 160)',
        typicalFill: 'oklch(0.42 0.01 160 / 0.15)',
        actual:  '#34d399',
        projected: '#a78bfa',
        today:   'oklch(0.42 0.01 160)',
        tooltipBg:     '#1a2421',
        tooltipBorder: 'oklch(0.26 0.01 160)',
      }
    : {
        grid:    'oklch(0.88 0.005 160)',
        axis:    'oklch(0.65 0.008 160)',
        typical: 'oklch(0.65 0.008 160)',
        typicalFill: 'oklch(0.65 0.008 160 / 0.12)',
        actual:  '#059669',
        projected: '#7c3aed',
        today:   'oklch(0.65 0.008 160)',
        tooltipBg:     '#ffffff',
        tooltipBorder: 'oklch(0.88 0.005 160)',
      }

  const chartData = data.points.map((p) => ({
    day:        p.day,
    Tipico:     p.typicalMinor,
    Attuale:    p.actualMinor,
    Proiezione: p.projectedMinor,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: colors.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v) => fmtEur(v)}
          tick={{ fill: colors.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={88}
        />
        <Tooltip
          formatter={(value, name) => [fmtEur(Number(value)), String(name)]}
          labelFormatter={(day) => `Giorno ${day}`}
          contentStyle={{
            background: colors.tooltipBg,
            border: `1px solid ${colors.tooltipBorder}`,
            borderRadius: 10,
            fontSize: 12,
            boxShadow: '0 4px 12px oklch(0 0 0 / 0.12)',
          }}
        />
        <ReferenceLine
          x={data.today}
          stroke={colors.today}
          strokeDasharray="3 3"
          label={{ value: 'oggi', fill: colors.axis, fontSize: 11, position: 'insideTopRight' }}
        />
        <Area
          type="monotone"
          dataKey="Tipico"
          stroke={colors.typical}
          strokeWidth={1.5}
          fill={colors.typicalFill}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="Attuale"
          stroke={colors.actual}
          strokeWidth={2.5}
          dot={false}
          connectNulls={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="Proiezione"
          stroke={colors.projected}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
