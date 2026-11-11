'use client'

// Andamento giornaliero del mese su calendario completo: i giorni a zero
// esistono (il "ritmo" è reale) e la media è per giorno di calendario.
import { formatAxisMoney } from '@/lib/format'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { DailyCalPoint } from '@/lib/monthReport'
import { useChartTheme } from '@/components/charts/chartTheme'

interface Props {
  data:          DailyCalPoint[]
  avgDailyMinor: number       // media per giorno trascorso, calcolata dal motore
  currency:      string
}

function fmt(minor: number, currency: string) {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency', useGrouping: 'always', currency, maximumFractionDigits: 0,
  })
}

export default function SpendingTrend({ data, avgDailyMinor, currency }: Props) {
  const t = useChartTheme()

  if (data.length === 0) {
    return <p className="text-sm text-(--faint) py-8 text-center">Nessun dato disponibile.</p>
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
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
        <XAxis
          dataKey="day"
          tick={t.tick}
          tickLine={false}
          axisLine={false}
          interval={tickInterval - 1}
        />
        <YAxis
          tickFormatter={(v) => formatAxisMoney(Number(v), currency)}
          tick={t.tick}
          tickLine={false}
          axisLine={false}
          width={64}
        />
        <Tooltip
          cursor={{ fill: t.grid, opacity: 0.5 }}
          isAnimationActive={false}
          formatter={(value, name) => [
            fmt(Number(value), currency),
            name === 'uscite' ? 'Uscite' : 'Entrate',
          ]}
          labelFormatter={(l) => {
            const point = chartData[Number(l) - 1]
            return `Giorno ${String(l)}${point?.weekend ? ' · weekend' : ''}`
          }}
          contentStyle={t.tooltip}
        />
        {avgDailyMinor > 0 && (
          <ReferenceLine
            y={avgDailyMinor}
            stroke={t.axis}
            strokeDasharray="4 2"
            label={{ value: 'media/giorno', position: 'insideTopRight', fill: t.axis, fontSize: 10 }}
          />
        )}
        <Bar isAnimationActive={false} dataKey="uscite" radius={[3, 3, 0, 0]} maxBarSize={16}>
          {chartData.map((d) => (
            <Cell
              key={d.day}
              fill={t.soft}
              opacity={d.isMax ? 1 : 0.5}
            />
          ))}
        </Bar>
        <Bar isAnimationActive={false} dataKey="entrate" fill={t.brand} opacity={0.7} radius={[3, 3, 0, 0]} maxBarSize={16} />
      </BarChart>
    </ResponsiveContainer>
  )
}
