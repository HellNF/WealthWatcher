'use client'

import { formatAxisMoney, fmtEur } from '@/lib/format'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import type { LifestyleCreepPoint } from '@/lib/analytics'
import { useChartTheme, shortMonth } from '@/components/charts/chartTheme'

interface Props {
  data: LifestyleCreepPoint[]
}

export default function LifestyleCreepChart({ data }: Props) {
  const t = useChartTheme()

  if (data.length < 3) {
    return (
      <p className="text-sm text-(--muted) py-4 text-center">
        Servono almeno 3 mesi con entrate per visualizzare il grafico.
      </p>
    )
  }

  const chartData = data.map((d) => ({
    month:    shortMonth(d.month),
    Entrate:  d.inflow,
    Uscite:   d.outflow,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Line isAnimationActive={false} type="monotone" dataKey="Entrate" stroke={t.brand} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        <Line isAnimationActive={false} type="monotone" dataKey="Uscite"  stroke={t.soft}  strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
