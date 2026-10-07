'use client'
// Andamento del saldo ricostruito dai movimenti: una linea compatta per la
// colonna di riepilogo. Passando il puntatore si legge il saldo di quel giorno.
import { useId, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useReducedMotion } from 'motion/react'
import { useTheme } from '@/components/providers/ThemeProvider'

export interface BalancePoint { date: string; value: number }

function fmtDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('it-IT', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Rome',
  })
}

export default function BalanceTrend({ points, currency }: { points: BalancePoint[]; currency: string }) {
  const { resolvedTheme } = useTheme()
  const reduceMotion = useReducedMotion()
  const gradId = useId()
  const [active, setActive] = useState<number | null>(null)

  if (points.length < 2) return null

  const data  = points.map((p) => ({ t: Date.parse(`${p.date}T12:00:00Z`), value: p.value, date: p.date }))
  const first = data[0]
  const shown = active !== null && data[active] ? data[active] : null
  const stroke = resolvedTheme === 'dark' ? 'oklch(0.92 0.01 160)' : 'oklch(0.25 0.01 160)'
  const fmt = (minor: number) =>
    (minor / 100).toLocaleString('it-IT', { style: 'currency', currency, useGrouping: 'always' })

  return (
    <div className="space-y-1.5">
      <p className="flex items-baseline justify-between gap-3 text-xs text-(--muted) min-h-4">
        <span>{shown ? fmtDay(shown.date) : `Andamento dal ${fmtDay(first.date)}`}</span>
        {shown && <span className="font-mono tabular-nums text-(--ink)">{fmt(shown.value)}</span>}
      </p>
      <div className="h-24 touch-pan-y select-none [&_.recharts-surface]:outline-none">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 4, right: 2, left: 2, bottom: 0 }}
            onMouseMove={(s) => setActive(s.isTooltipActive && s.activeTooltipIndex != null ? Number(s.activeTooltipIndex) : null)}
            onMouseLeave={() => setActive(null)}
            onTouchMove={(s) => setActive(s.isTooltipActive && s.activeTooltipIndex != null ? Number(s.activeTooltipIndex) : null)}
            onTouchEnd={() => setActive(null)}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.18} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} hide />
            <YAxis domain={['auto', 'auto']} hide />
            <Tooltip content={() => null} cursor={{ stroke, strokeWidth: 1, strokeOpacity: 0.4 }} isAnimationActive={false} />
            <Area
              type="stepAfter"
              dataKey="value"
              stroke={stroke}
              strokeWidth={1.5}
              fill={`url(#${gradId})`}
              dot={false}
              activeDot={{ r: 3.5, fill: stroke, strokeWidth: 0 }}
              isAnimationActive={!reduceMotion}
              animationDuration={300}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
