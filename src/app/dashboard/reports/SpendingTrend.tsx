'use client'

// Andamento giornaliero del mese su calendario completo: i giorni a zero
// esistono (il "ritmo" è reale) e la media è per giorno di calendario.
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { DailyCalPoint } from '@/lib/monthReport'
import { useTheme } from '@/components/providers/ThemeProvider'

interface Props {
  data:          DailyCalPoint[]
  avgDailyMinor: number       // media per giorno trascorso, calcolata dal motore
  currency:      string
}

function fmt(minor: number, currency: string) {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency', currency, maximumFractionDigits: 0,
  })
}

export default function SpendingTrend({ data, avgDailyMinor, currency }: Props) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const colors = isDark
    ? { outflow: '#f87171', inflow: '#34d399', grid: 'oklch(0.26 0.01 160)', axis: 'oklch(0.42 0.01 160)', tooltipBg: '#1a2421', tooltipBorder: 'oklch(0.26 0.01 160)' }
    : { outflow: '#dc2626', inflow: '#059669', grid: 'oklch(0.88 0.005 160)', axis: 'oklch(0.55 0.01 160)', tooltipBg: '#fff', tooltipBorder: 'oklch(0.88 0.005 160)' }

  if (data.length === 0) {
    return <p className="text-sm text-[--faint] py-8 text-center">Nessun dato disponibile.</p>
  }

  const visible = data.filter((d) => !d.isFuture)
  const maxOutflow = Math.max(...visible.map((d) => d.outflowMinor))

  const chartData = data.map((d) => ({
    day:     d.day,
    uscite:  d.isFuture ? null : d.outflowMinor,
    entrate: d.isFuture ? null : d.inflowMinor,
    isMax:   d.outflowMinor === maxOutflow && maxOutflow > 0 && !d.isFuture,
    weekend: d.weekday === 0 || d.weekday === 6,
  }))

  // Tick ogni ~5 giorni, sempre il giorno 1 e l'ultimo
  const tickInterval = Math.max(1, Math.round(data.length / 7))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: colors.axis, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={tickInterval - 1}
        />
        <YAxis
          tickFormatter={(v) => fmt(v, currency)}
          tick={{ fill: colors.axis, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={72}
        />
        <Tooltip
          formatter={(value, name) => [
            fmt(Number(value), currency),
            name === 'uscite' ? 'Uscite' : 'Entrate',
          ]}
          labelFormatter={(l) => {
            const point = chartData[Number(l) - 1]
            return `Giorno ${String(l)}${point?.weekend ? ' · weekend' : ''}`
          }}
          contentStyle={{
            background: colors.tooltipBg,
            border: `1px solid ${colors.tooltipBorder}`,
            borderRadius: 10,
            fontSize: 12,
            boxShadow: '0 4px 12px oklch(0 0 0 / 0.12)',
          }}
        />
        {avgDailyMinor > 0 && (
          <ReferenceLine
            y={avgDailyMinor}
            stroke={colors.axis}
            strokeDasharray="4 2"
            label={{ value: 'media/giorno', position: 'insideTopRight', fill: colors.axis, fontSize: 10 }}
          />
        )}
        <Bar dataKey="uscite" radius={[3, 3, 0, 0]} maxBarSize={16}>
          {chartData.map((d) => (
            <Cell
              key={d.day}
              fill={colors.outflow}
              opacity={d.isMax ? 1 : 0.6}
            />
          ))}
        </Bar>
        <Bar dataKey="entrate" fill={colors.inflow} opacity={0.7} radius={[3, 3, 0, 0]} maxBarSize={16} />
      </BarChart>
    </ResponsiveContainer>
  )
}
