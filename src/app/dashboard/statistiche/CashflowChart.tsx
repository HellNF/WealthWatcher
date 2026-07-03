'use client'

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { MonthlyCashflow } from '@/lib/analytics'
import { useTheme } from '@/components/providers/ThemeProvider'

interface Props {
  data: MonthlyCashflow[]
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

export default function CashflowChart({ data }: Props) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  if (data.length < 2) {
    return (
      <p className="text-sm text-[--muted] py-6 text-center">
        Il grafico si popola con almeno 2 mesi di movimenti importati.
      </p>
    )
  }

  const colors = isDark
    ? {
        grid:    'oklch(0.26 0.01 160)',
        axis:    'oklch(0.42 0.01 160)',
        inflow:  '#34d399',
        outflow: '#f87171',
        net:     '#a78bfa',
        tooltipBg:     '#1a2421',
        tooltipBorder: 'oklch(0.26 0.01 160)',
        zero:    'oklch(0.42 0.01 160)',
      }
    : {
        grid:    'oklch(0.88 0.005 160)',
        axis:    'oklch(0.65 0.008 160)',
        inflow:  '#059669',
        outflow: '#dc2626',
        net:     '#7c3aed',
        tooltipBg:     '#ffffff',
        tooltipBorder: 'oklch(0.88 0.005 160)',
        zero:    'oklch(0.65 0.008 160)',
      }

  const chartData = data.map((d) => ({
    month:   shortMonth(d.month),
    Entrate: d.inflow,
    Uscite:  d.outflow,
    Netto:   d.net,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
        <ReferenceLine y={0} stroke={colors.zero} strokeDasharray="3 3" />
        <Bar dataKey="Entrate" fill={colors.inflow}  opacity={0.7} radius={[3,3,0,0]} maxBarSize={32} />
        <Bar dataKey="Uscite"  fill={colors.outflow} opacity={0.7} radius={[3,3,0,0]} maxBarSize={32} />
        <Line
          type="monotone"
          dataKey="Netto"
          stroke={colors.net}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
