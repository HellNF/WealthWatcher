'use client'

import { formatAxisMoney, fmtEur } from '@/lib/format'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { FixedVariableMonth } from '@/lib/spendingInsights'
import { useChartTheme, shortMonth } from '@/components/charts/chartTheme'

interface Props {
  data: FixedVariableMonth[]
}

/** Spesa mensile impilata: quota fissa (incomprimibile) + quota variabile. */
export default function FixedVariableChart({ data }: Props) {
  const t = useChartTheme()

  const colors = {
    fixed: t.dark ? 'oklch(0.50 0.01 160)' : 'oklch(0.70 0.008 160)',
    variable: t.dark ? 'oklch(0.84 0.01 160)' : 'oklch(0.38 0.01 160)',
  }

  const chartData = data.map((d) => ({
    month:     shortMonth(d.month),
    Fisse:     d.fixedMinor,
    Variabili: d.variableMinor,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
        <XAxis
          dataKey="month"
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
          contentStyle={t.tooltip}
        />
        <Bar isAnimationActive={false} dataKey="Fisse"     stackId="s" fill={colors.fixed}    opacity={0.55} maxBarSize={36} />
        <Bar isAnimationActive={false} dataKey="Variabili" stackId="s" fill={colors.variable} opacity={0.8} radius={[3, 3, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  )
}
