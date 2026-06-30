'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { ValuationSnapshot } from '@/db/schema'
import { useTheme } from '@/components/providers/ThemeProvider'

interface Props {
  snapshots: ValuationSnapshot[]
}

function formatEur(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export default function NetWorthChart({ snapshots }: Props) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  if (snapshots.length < 2) {
    return (
      <p className="text-sm text-[--muted] py-6 text-center">
        Il grafico si popola nei prossimi giorni (servono almeno 2 snapshot).
      </p>
    )
  }

  const data = snapshots.map((s) => ({
    date: shortDate(s.date),
    value: s.net_worth_eur_minor,
  }))

  // Token values matched to OKLCH definitions in globals.css
  // Brand: teal/cyan — distinto dal gain (verde P/L)
  const colors = isDark
    ? {
        brand:    '#2dd4bf', // teal-400 ≈ --brand dark oklch(0.68 0.14 198)
        brandFill:'#14b8a6', // teal-500 per fill gradient
        grid:     'oklch(0.290 0.018 205)', // --border dark
        axis:     'oklch(0.42 0.012 205)',  // --faint dark
        tooltipBg:     '#131c1f',           // ≈ --surface dark oklch(0.155 0.012 205)
        tooltipBorder: 'oklch(0.290 0.018 205)',
        tooltipLabel:  'oklch(0.60 0.018 205)', // --muted dark
      }
    : {
        brand:    '#0f766e', // teal-700 ≈ --brand light oklch(0.46 0.12 198)
        brandFill:'#0d9488', // teal-600 per fill gradient
        grid:     'oklch(0.836 0.010 205)', // --border light
        axis:     'oklch(0.56 0.012 205)',  // --faint light
        tooltipBg:     '#ffffff',
        tooltipBorder: 'oklch(0.836 0.010 205)',
        tooltipLabel:  'oklch(0.40 0.018 205)', // --muted light
      }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={colors.brand} stopOpacity={isDark ? 0.25 : 0.15} />
            <stop offset="100%" stopColor={colors.brand} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={colors.grid}
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: colors.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v) => formatEur(v)}
          tick={{ fill: colors.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={88}
        />
        <Tooltip
          formatter={(value) => [formatEur(Number(value)), 'Net worth']}
          labelFormatter={(label) => `Data: ${String(label)}`}
          contentStyle={{
            background: colors.tooltipBg,
            border: `1px solid ${colors.tooltipBorder}`,
            borderRadius: 10,
            fontSize: 12,
            boxShadow: '0 4px 12px oklch(0 0 0 / 0.12)',
          }}
          itemStyle={{ color: colors.brand }}
          labelStyle={{ color: colors.tooltipLabel }}
          cursor={{ stroke: colors.grid, strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={colors.brand}
          strokeWidth={2}
          fill="url(#netWorthGrad)"
          dot={false}
          activeDot={{ r: 4, fill: colors.brand, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
