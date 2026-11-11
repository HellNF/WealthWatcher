'use client'

import { formatAxisMoney, fmtEur } from '@/lib/format'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { MonthlyCashflow } from '@/lib/analytics'
import { useChartTheme, shortMonth } from '@/components/charts/chartTheme'

interface Props {
  data: MonthlyCashflow[]
}

export default function CashflowChart({ data }: Props) {
  const t = useChartTheme()

  if (data.length < 2) {
    return (
      <p className="text-sm text-(--muted) py-6 text-center">
        Il grafico si popola con almeno 2 mesi di movimenti importati.
      </p>
    )
  }

  const chartData = data.map((d) => ({
    month:   shortMonth(d.month),
    Entrate: d.inflow,
    Uscite:  d.outflow,
    Netto:   d.net,
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
        <ReferenceLine y={0} stroke={t.faint} strokeDasharray="3 3" />
        <Bar isAnimationActive={false} dataKey="Entrate" fill={t.brand}  opacity={0.7} radius={[3,3,0,0]} maxBarSize={32} />
        <Bar isAnimationActive={false} dataKey="Uscite"  fill={t.soft} opacity={0.7} radius={[3,3,0,0]} maxBarSize={32} />
        <Line isAnimationActive={false}
          type="monotone"
          dataKey="Netto"
          stroke={t.violet}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
