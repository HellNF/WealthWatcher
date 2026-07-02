'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { CategoryTotal } from '@/lib/reports'
import { useTheme } from '@/components/providers/ThemeProvider'

interface Props {
  data:     CategoryTotal[]
  currency: string
}

const FALLBACK_COLORS = [
  '#059669','#0891b2','#7c3aed','#d97706','#dc2626','#0284c7','#65a30d','#db2777',
]

function fmt(minor: number, currency: string) {
  return (minor / 100).toLocaleString('it-IT', { style: 'currency', currency, maximumFractionDigits: 0 })
}

export default function CategoryDonut({ data, currency }: Props) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const total = data.reduce((s, d) => s + Math.abs(d.total_minor), 0)

  const tooltipStyle = {
    background:   isDark ? '#1a2421' : '#ffffff',
    border:       `1px solid ${isDark ? 'oklch(0.26 0.01 160)' : 'oklch(0.88 0.005 160)'}`,
    borderRadius: 10,
    fontSize:     12,
    boxShadow:    '0 4px 12px oklch(0 0 0 / 0.12)',
  }

  const chartData = data.map((d, i) => ({
    name:  d.category_name ?? 'Senza categoria',
    value: Math.abs(d.total_minor),
    color: d.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  }))

  return (
    <div className="flex flex-col items-center gap-4">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            innerRadius="52%"
            outerRadius="76%"
            paddingAngle={2}
            startAngle={90}
            endAngle={-270}
            strokeWidth={0}
          >
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, _name, props) => {
              const pct = total > 0 ? ((Number(value) / total) * 100).toFixed(1) : '0'
              return [`${fmt(Number(value), currency)} · ${pct}%`, props.payload?.name]
            }}
            contentStyle={tooltipStyle}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legenda compatta */}
      <div className="w-full grid grid-cols-2 gap-x-4 gap-y-1.5">
        {chartData.map((d, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0">
            <span className="size-2 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-xs text-[--muted] truncate">{d.name}</span>
            <span className="ml-auto text-xs tabular-nums text-[--ink] shrink-0">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
