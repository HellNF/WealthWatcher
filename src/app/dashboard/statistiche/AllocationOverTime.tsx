'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import type { AllocationPoint } from '@/lib/analytics'
import { useTheme } from '@/components/providers/ThemeProvider'

interface Props {
  data: AllocationPoint[]
}

function fmtEur(minor: number): string {
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

export default function AllocationOverTime({ data }: Props) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  if (data.length < 2) {
    return (
      <p className="text-sm text-[--muted] py-6 text-center">
        Il grafico si popola con almeno 2 snapshot di patrimonio.
      </p>
    )
  }

  const colors = isDark
    ? {
        grid:   'oklch(0.26 0.01 160)',
        axis:   'oklch(0.42 0.01 160)',
        inv:    '#34d399',
        acc:    '#60a5fa',
        other:  '#f59e0b',
        tooltipBg:     '#1a2421',
        tooltipBorder: 'oklch(0.26 0.01 160)',
      }
    : {
        grid:   'oklch(0.88 0.005 160)',
        axis:   'oklch(0.65 0.008 160)',
        inv:    '#059669',
        acc:    '#2563eb',
        other:  '#d97706',
        tooltipBg:     '#ffffff',
        tooltipBorder: 'oklch(0.88 0.005 160)',
      }

  const chartData = data.map((p) => ({
    date:        shortDate(p.date),
    Investimenti: p.investments,
    'Conti':      p.accounts,
    'Altri beni': p.otherAssets,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradInv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={colors.inv}   stopOpacity={isDark ? 0.5 : 0.35} />
            <stop offset="100%" stopColor={colors.inv}   stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="gradAcc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={colors.acc}   stopOpacity={isDark ? 0.5 : 0.35} />
            <stop offset="100%" stopColor={colors.acc}   stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="gradOther" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={colors.other} stopOpacity={isDark ? 0.5 : 0.35} />
            <stop offset="100%" stopColor={colors.other} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
        <XAxis
          dataKey="date"
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
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
        <Area
          type="monotone"
          dataKey="Investimenti"
          stackId="1"
          stroke={colors.inv}
          strokeWidth={1.5}
          fill="url(#gradInv)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="Conti"
          stackId="1"
          stroke={colors.acc}
          strokeWidth={1.5}
          fill="url(#gradAcc)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="Altri beni"
          stackId="1"
          stroke={colors.other}
          strokeWidth={1.5}
          fill="url(#gradOther)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
