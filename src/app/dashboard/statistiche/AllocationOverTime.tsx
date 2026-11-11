'use client'

import { formatAxisMoney, fmtEur } from '@/lib/format'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import type { AllocationPoint } from '@/lib/analytics'
import { useChartTheme } from '@/components/charts/chartTheme'

interface Props {
  data: AllocationPoint[]
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export default function AllocationOverTime({ data }: Props) {
  const t = useChartTheme()

  if (data.length < 2) {
    return (
      <p className="text-sm text-(--muted) py-6 text-center">
        Il grafico si popola con almeno 2 snapshot di patrimonio.
      </p>
    )
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
            <stop offset="0%"   stopColor={t.brand}   stopOpacity={t.dark ? 0.5 : 0.35} />
            <stop offset="100%" stopColor={t.brand}   stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="gradAcc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={t.blue}   stopOpacity={t.dark ? 0.5 : 0.35} />
            <stop offset="100%" stopColor={t.blue}   stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="gradOther" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={t.amber} stopOpacity={t.dark ? 0.5 : 0.35} />
            <stop offset="100%" stopColor={t.amber} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
        <XAxis
          dataKey="date"
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
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
        <Area isAnimationActive={false}
          type="monotone"
          dataKey="Investimenti"
          stackId="1"
          stroke={t.brand}
          strokeWidth={1.5}
          fill="url(#gradInv)"
          dot={false}
        />
        <Area isAnimationActive={false}
          type="monotone"
          dataKey="Conti"
          stackId="1"
          stroke={t.blue}
          strokeWidth={1.5}
          fill="url(#gradAcc)"
          dot={false}
        />
        <Area isAnimationActive={false}
          type="monotone"
          dataKey="Altri beni"
          stackId="1"
          stroke={t.amber}
          strokeWidth={1.5}
          fill="url(#gradOther)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
