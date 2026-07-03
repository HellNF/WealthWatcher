'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import type { LifestyleCreepPoint } from '@/lib/analytics'
import { useTheme } from '@/components/providers/ThemeProvider'

interface Props {
  data: LifestyleCreepPoint[]
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

export default function LifestyleCreepChart({ data }: Props) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  if (data.length < 3) {
    return (
      <p className="text-sm text-[--muted] py-4 text-center">
        Servono almeno 3 mesi con entrate per visualizzare il grafico.
      </p>
    )
  }

  const colors = isDark
    ? {
        grid:    'oklch(0.26 0.01 160)',
        axis:    'oklch(0.42 0.01 160)',
        income:  '#34d399',
        spend:   '#f87171',
        tooltipBg:     '#1a2421',
        tooltipBorder: 'oklch(0.26 0.01 160)',
      }
    : {
        grid:    'oklch(0.88 0.005 160)',
        axis:    'oklch(0.65 0.008 160)',
        income:  '#059669',
        spend:   '#dc2626',
        tooltipBg:     '#ffffff',
        tooltipBorder: 'oklch(0.88 0.005 160)',
      }

  const chartData = data.map((d) => ({
    month:    shortMonth(d.month),
    Entrate:  d.inflow,
    Uscite:   d.outflow,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Line type="monotone" dataKey="Entrate" stroke={colors.income} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        <Line type="monotone" dataKey="Uscite"  stroke={colors.spend}  strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
