'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import type { WeekdaySpending } from '@/lib/analytics'
import { useTheme } from '@/components/providers/ThemeProvider'

interface Props {
  data: WeekdaySpending[]
}

function fmtEur(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
}

export default function WeekdayChart({ data }: Props) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  if (data.length === 0) {
    return (
      <p className="text-sm text-[--muted] py-6 text-center">
        Importa movimenti per vedere i pattern per giorno della settimana.
      </p>
    )
  }

  const colors = isDark
    ? {
        grid:    'oklch(0.26 0.01 160)',
        axis:    'oklch(0.42 0.01 160)',
        bar:     '#34d399',
        barDim:  '#34d39955',
        tooltipBg:     '#1a2421',
        tooltipBorder: 'oklch(0.26 0.01 160)',
      }
    : {
        grid:    'oklch(0.88 0.005 160)',
        axis:    'oklch(0.65 0.008 160)',
        bar:     '#059669',
        barDim:  '#05966940',
        tooltipBg:     '#ffffff',
        tooltipBorder: 'oklch(0.88 0.005 160)',
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
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: colors.axis, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v) => fmtEur(v)}
          tick={{ fill: colors.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={80}
        />
        <Tooltip
          formatter={(value, _name, entry) => {
            const d = entry?.payload as WeekdaySpending | undefined
            const extra = d
              ? ` · ${d.sharePct.toLocaleString('it-IT')}% del totale${d.topCategory ? ` · soprattutto ${d.topCategory}` : ''}`
              : ''
            return [`${fmtEur(Number(value))}${extra}`, 'Spesa totale']
          }}
          contentStyle={{
            background: colors.tooltipBg,
            border: `1px solid ${colors.tooltipBorder}`,
            borderRadius: 10,
            fontSize: 12,
            boxShadow: '0 4px 12px oklch(0 0 0 / 0.12)',
          }}
        />
        <Bar dataKey="totalMinor" radius={[4, 4, 0, 0]} maxBarSize={40}>
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
