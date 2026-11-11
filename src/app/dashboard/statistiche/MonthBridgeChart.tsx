'use client'

import { formatAxisMoney, fmtEur } from '@/lib/format'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import type { MonthBridge } from '@/lib/spendingInsights'
import { useChartTheme } from '@/components/charts/chartTheme'

interface Props {
  data: MonthBridge
}

/**
 * Barre orizzontali divergenti: quanto ogni categoria si discosta dal
 * mese tipico (rosso = speso di più, verde = speso di meno).
 */
export default function MonthBridgeChart({ data }: Props) {
  const t = useChartTheme()

  const rows = data.items.slice(0, 8).map((i) => ({
    name:    i.categoryName,
    delta:   i.deltaMinor,
    actual:  i.actualMinor,
    typical: i.typicalMinor,
  }))
  if (Math.abs(data.otherDeltaMinor) >= 500) {
    rows.push({ name: 'Altre categorie', delta: data.otherDeltaMinor, actual: 0, typical: 0 })
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-(--muted) py-6 text-center">
        Nessuno scostamento rilevante dal tuo mese tipico.
      </p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 38 + 30)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={t.grid} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => formatAxisMoney(Number(v))}
          tick={t.tick}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: t.axis, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={120}
        />
        <Tooltip isAnimationActive={false}
          formatter={(value, _name, entry) => {
            const p = entry?.payload as (typeof rows)[number] | undefined
            const detail = p && p.name !== 'Altre categorie'
              ? ` (speso ${fmtEur(p.actual, 0)} vs tipico ${fmtEur(p.typical, 0)})`
              : ''
            const v = Number(value)
            return [`${v >= 0 ? '+' : ''}${fmtEur(v, 0)}${detail}`, 'vs mese tipico']
          }}
          contentStyle={t.tooltip}
        />
        <ReferenceLine x={0} stroke={t.faint} />
        <Bar isAnimationActive={false} dataKey="delta" radius={[0, 3, 3, 0]} maxBarSize={22}>
          {rows.map((r, i) => (
            <Cell key={i} fill={r.delta >= 0 ? t.danger : t.brand} opacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
