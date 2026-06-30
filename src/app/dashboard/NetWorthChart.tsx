'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { ValuationSnapshot } from '@/db/schema'

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
  // "2024-03-15" → "15/03"
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export default function NetWorthChart({ snapshots }: Props) {
  if (snapshots.length < 2) {
    return (
      <p className="text-sm text-zinc-500 py-4 text-center">
        Il grafico si popola nei prossimi giorni (servono almeno 2 snapshot).
      </p>
    )
  }

  const data = snapshots.map((s) => ({
    date: shortDate(s.date),
    fullDate: s.date,
    value: s.net_worth_eur_minor,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#71717a', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v) => formatEur(v)}
          tick={{ fill: '#71717a', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={90}
        />
        <Tooltip
          formatter={(value) => [formatEur(Number(value)), 'Net worth']}
          labelFormatter={(label) => `Data: ${String(label)}`}
          contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
          itemStyle={{ color: '#10b981' }}
          labelStyle={{ color: '#a1a1aa' }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#10b981' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
