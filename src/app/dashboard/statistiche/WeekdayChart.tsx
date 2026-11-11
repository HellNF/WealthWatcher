'use client'

import { formatAxisMoney, fmtEur } from '@/lib/format'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import type { WeekdaySpending } from '@/lib/analytics'
import { useChartTheme } from '@/components/charts/chartTheme'

interface Props {
  data: WeekdaySpending[]
}

export default function WeekdayChart({ data }: Props) {
  const t = useChartTheme()

  if (data.length === 0) {
    return (
      <p className="text-sm text-(--muted) py-6 text-center">
        Importa movimenti per vedere i pattern per giorno della settimana.
      </p>
    )
  }

  const colors = {
    bar: t.dark ? 'oklch(0.90 0.01 160)' : 'oklch(0.28 0.01 160)',
    barDim: t.dark ? 'oklch(0.42 0.01 160)' : 'oklch(0.80 0.005 160)',
  }

  // Riordina Lun–Dom (stile europeo): 1,2,3,4,5,6,0
  const euroOrder = [1, 2, 3, 4, 5, 6, 0]
  const sorted = euroOrder
    .map((wd) => data.find((d) => d.weekday === wd))
    .filter(Boolean) as WeekdaySpending[]

  const maxTotal = Math.max(...sorted.map((d) => d.totalMinor), 1)

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={sorted} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: t.axis, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v) => formatAxisMoney(Number(v))}
          tick={t.tick}
          tickLine={false}
          axisLine={false}
          width={80}
        />
        <Tooltip isAnimationActive={false}
          formatter={(value, _name, entry) => {
            const d = entry?.payload as WeekdaySpending | undefined
            const extra = d
              ? ` · ${d.sharePct.toLocaleString('it-IT')}% del totale${d.topCategory ? ` · soprattutto ${d.topCategory}` : ''}`
              : ''
            return [`${fmtEur(Number(value), 0)}${extra}`, 'Spesa totale']
          }}
          contentStyle={t.tooltip}
        />
        <Bar isAnimationActive={false} dataKey="totalMinor" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {sorted.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.totalMinor === maxTotal ? colors.bar : colors.barDim}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
