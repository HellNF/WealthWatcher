'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import type { MonthBridge } from '@/lib/spendingInsights'
import { useTheme } from '@/components/providers/ThemeProvider'

interface Props {
  data: MonthBridge
}

function fmtEur(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
}

/**
 * Barre orizzontali divergenti: quanto ogni categoria si discosta dal
 * mese tipico (rosso = speso di più, verde = speso di meno).
 */
export default function MonthBridgeChart({ data }: Props) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const colors = isDark
    ? {
        grid:  'oklch(0.26 0.01 160)',
        axis:  'oklch(0.42 0.01 160)',
        over:  '#f87171',
        under: '#34d399',
        zero:  'oklch(0.42 0.01 160)',
        tooltipBg:     '#1a2421',
        tooltipBorder: 'oklch(0.26 0.01 160)',
      }
    : {
        grid:  'oklch(0.88 0.005 160)',
        axis:  'oklch(0.65 0.008 160)',
        over:  '#dc2626',
        under: '#059669',
        zero:  'oklch(0.65 0.008 160)',
        tooltipBg:     '#ffffff',
        tooltipBorder: 'oklch(0.88 0.005 160)',
      }

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
      <p className="text-sm text-[--muted] py-6 text-center">
        Nessuno scostamento rilevante dal tuo mese tipico.
      </p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 38 + 30)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => fmtEur(v)}
          tick={{ fill: colors.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: colors.axis, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={120}
        />
        <Tooltip
          formatter={(value, _name, entry) => {
            const p = entry?.payload as (typeof rows)[number] | undefined
            const detail = p && p.name !== 'Altre categorie'
              ? ` (speso ${fmtEur(p.actual)} vs tipico ${fmtEur(p.typical)})`
              : ''
            const v = Number(value)
            return [`${v >= 0 ? '+' : ''}${fmtEur(v)}${detail}`, 'vs mese tipico']
          }}
          contentStyle={{
            background: colors.tooltipBg,
            border: `1px solid ${colors.tooltipBorder}`,
            borderRadius: 10,
            fontSize: 12,
            boxShadow: '0 4px 12px oklch(0 0 0 / 0.12)',
          }}
        />
        <ReferenceLine x={0} stroke={colors.zero} />
        <Bar dataKey="delta" radius={[0, 3, 3, 0]} maxBarSize={22}>
          {rows.map((r, i) => (
            <Cell key={i} fill={r.delta >= 0 ? colors.over : colors.under} opacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
