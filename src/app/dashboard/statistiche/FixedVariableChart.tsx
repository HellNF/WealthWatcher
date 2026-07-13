'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { FixedVariableMonth } from '@/lib/spendingInsights'
import { useTheme } from '@/components/providers/ThemeProvider'

interface Props {
  data: FixedVariableMonth[]
}

function fmtEur(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
}

function shortMonth(ym: string): string {
  const [y, m] = ym.split('-')
  const labels = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']
  return `${labels[parseInt(m, 10) - 1]} ${y.slice(2)}`
}

/** Spesa mensile impilata: quota fissa (incomprimibile) + quota variabile. */
export default function FixedVariableChart({ data }: Props) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const colors = isDark
    ? {
        grid:     'oklch(0.26 0.01 160)',
        axis:     'oklch(0.42 0.01 160)',
        fixed:    'oklch(0.42 0.01 160)',
        variable: '#34d399',
        tooltipBg:     '#1a2421',
        tooltipBorder: 'oklch(0.26 0.01 160)',
      }
    : {
        grid:     'oklch(0.88 0.005 160)',
        axis:     'oklch(0.65 0.008 160)',
        fixed:    'oklch(0.65 0.008 160)',
        variable: '#059669',
        tooltipBg:     '#ffffff',
        tooltipBorder: 'oklch(0.88 0.005 160)',
      }

  const chartData = data.map((d) => ({
    month:     shortMonth(d.month),
    Fisse:     d.fixedMinor,
    Variabili: d.variableMinor,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
        <XAxis
          dataKey="month"
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
          contentStyle={{
            background: colors.tooltipBg,
            border: `1px solid ${colors.tooltipBorder}`,
            borderRadius: 10,
            fontSize: 12,
            boxShadow: '0 4px 12px oklch(0 0 0 / 0.12)',
          }}
        />
        <Bar dataKey="Fisse"     stackId="s" fill={colors.fixed}    opacity={0.55} maxBarSize={36} />
        <Bar dataKey="Variabili" stackId="s" fill={colors.variable} opacity={0.8} radius={[3, 3, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  )
}
