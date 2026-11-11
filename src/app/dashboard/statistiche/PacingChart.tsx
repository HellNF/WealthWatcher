'use client'

import { formatAxisMoney, fmtEur } from '@/lib/format'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { MonthPacing } from '@/lib/spendingInsights'
import { useChartTheme } from '@/components/charts/chartTheme'

interface Props {
  data: MonthPacing
}

/**
 * Cumulata di spesa del mese corrente (linea piena) contro il mese tipico
 * (area attenuata), con proiezione tratteggiata fino a fine mese.
 */
export default function PacingChart({ data }: Props) {
  const t = useChartTheme()

  const colors = {
    typicalFill: t.dark ? 'oklch(0.42 0.01 160 / 0.15)' : 'oklch(0.65 0.008 160 / 0.12)',
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
        <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
        <XAxis
          dataKey="day"
          tick={t.tick}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v) => formatAxisMoney(Number(v))}
          tick={t.tick}
          tickLine={false}
          axisLine={false}
          width={88}
        />
        <Tooltip isAnimationActive={false}
          formatter={(value, name) => [fmtEur(Number(value), 0), String(name)]}
          labelFormatter={(day) => `Giorno ${day}`}
          contentStyle={t.tooltip}
        />
        <ReferenceLine
          x={data.today}
          stroke={t.faint}
          strokeDasharray="3 3"
          label={{ value: 'oggi', fill: t.axis, fontSize: 11, position: 'insideTopRight' }}
        />
        <Area isAnimationActive={false}
          type="monotone"
          dataKey="Tipico"
          stroke={t.faint}
          strokeWidth={1.5}
          fill={colors.typicalFill}
          dot={false}
        />
        <Line isAnimationActive={false}
          type="monotone"
          dataKey="Attuale"
          stroke={t.strong}
          strokeWidth={2.5}
          dot={false}
          connectNulls={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Line isAnimationActive={false}
          type="monotone"
          dataKey="Proiezione"
          stroke={t.violet}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
