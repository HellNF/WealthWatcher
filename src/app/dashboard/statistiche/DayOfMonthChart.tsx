'use client'

import { formatAxisMoney, fmtEur } from '@/lib/format'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, Legend,
} from 'recharts'
import type { DaySpendingPoint } from '@/lib/analytics'
import { useChartTheme } from '@/components/charts/chartTheme'

interface Props {
  data: DaySpendingPoint[]
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
  const t = useChartTheme()

  if (data.length < 5) {
    return (
      <p className="text-sm text-(--muted) py-6 text-center">
        Importa almeno 2 mesi di movimenti per visualizzare i pattern per giorno del mese.
      </p>
    )
  }

  const colors = {
    bar: t.dark ? 'oklch(0.62 0.01 160)' : 'oklch(0.58 0.01 160)',
    barDim: t.dark ? 'oklch(0.36 0.01 160)' : 'oklch(0.84 0.005 160)',
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
        <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: t.axis, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={2}
        />
        <YAxis
          tickFormatter={(v) => formatAxisMoney(Number(v))}
          tick={t.tick}
          tickLine={false}
          axisLine={false}
          width={80}
        />
        <Tooltip isAnimationActive={false}
          formatter={(value, name) => [fmtEur(Number(value), 0), name === 'avgMinor' ? 'Spesa media' : String(name)]}
          labelFormatter={(label) => `Giorno ${label} del mese`}
          contentStyle={t.tooltip}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
        <ReferenceLine y={avg} stroke={t.faint} strokeDasharray="4 4" />
        <Bar isAnimationActive={false} dataKey="avgMinor" name="Spesa giornaliera" radius={[3, 3, 0, 0]} maxBarSize={20} legendType="none">
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.avgMinor >= p75 ? t.strong : entry.avgMinor >= avg ? colors.bar : colors.barDim}
            />
          ))}
        </Bar>
        <Line isAnimationActive={false}
          type="monotone"
          dataKey="Media Mobile Trend"
          stroke={t.violet}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
