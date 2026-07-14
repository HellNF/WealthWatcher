'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { useTheme } from '@/components/providers/ThemeProvider'
import type { CashProjectionPoint } from '@/lib/calendar'

interface Props {
  points:         CashProjectionPoint[]
  thresholdMinor: number
  minDate:        string
}

function fmtEur(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

type ChartColors = {
  brand: string; danger: string; warning: string; grid: string; axis: string
  tipBg: string; tipBorder: string; tipLabel: string; ink: string
}
interface TooltipEntry { payload?: CashProjectionPoint }

/** Tooltip a livello di modulo: riceve i colori del tema dal render-prop. */
function ProjectionTooltip(
  { active, payload, colors }: { active?: boolean; payload?: TooltipEntry[]; colors: ChartColors },
) {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload
  if (!p) return null
  return (
    <div style={{
      background: colors.tipBg, border: `1px solid ${colors.tipBorder}`,
      borderRadius: 10, fontSize: 12, padding: '8px 10px',
      boxShadow: '0 4px 12px oklch(0 0 0 / 0.12)', maxWidth: 240,
    }}>
      <p style={{ color: colors.tipLabel, marginBottom: 4 }}>{shortDate(p.date)}</p>
      <p style={{ color: p.balanceMinor < 0 ? colors.danger : colors.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {fmtEur(p.balanceMinor)}
      </p>
      {p.events.length > 0 && (
        <ul style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${colors.tipBorder}`, listStyle: 'none' }}>
          {p.events.slice(0, 4).map((e, i) => (
            <li key={i} style={{ color: e.direction === 'in' ? colors.brand : colors.danger, fontSize: 11, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {e.direction === 'in' ? '+' : '−'}{fmtEur(e.amountMinor)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function CashProjectionChart({ points, thresholdMinor, minDate }: Props) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  if (points.length < 2) {
    return (
      <p className="text-sm text-[--muted] py-6 text-center">
        La proiezione richiede uno storico movimenti sufficiente per essere stimata.
      </p>
    )
  }

  const data = points.map(p => ({ ...p, label: shortDate(p.date) }))
  const hasNegative = points.some(p => p.balanceMinor < 0)

  const colors: ChartColors = isDark
    ? { brand: '#34d399', danger: '#f87171', warning: '#fbbf24', grid: '#262626', axis: '#a3a3a3',
        tipBg: '#1a2421', tipBorder: '#2d3d38', tipLabel: '#a3a3a3', ink: '#e5e5e5' }
    : { brand: '#059669', danger: '#dc2626', warning: '#d97706', grid: '#e5e5e5', axis: '#6b7280',
        tipBg: '#ffffff', tipBorder: '#e5e7eb', tipLabel: '#6b7280', ink: '#171717' }

  const stroke = hasNegative ? colors.warning : colors.brand

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="cashProjGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={stroke} stopOpacity={isDark ? 0.35 : 0.22} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
        <XAxis
          dataKey="label" tick={{ fill: colors.axis, fontSize: 11 }}
          tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={40}
        />
        <YAxis
          tickFormatter={(v) => fmtEur(v)} tick={{ fill: colors.axis, fontSize: 11 }}
          tickLine={false} axisLine={false} width={78}
        />
        <Tooltip
          content={(props) => {
            const { active, payload } = props as unknown as { active?: boolean; payload?: TooltipEntry[] }
            return <ProjectionTooltip active={active} payload={payload} colors={colors} />
          }}
          cursor={{ stroke: colors.grid, strokeWidth: 1 }}
        />

        {/* Soglia di allerta (≈ 1 mese di spese) */}
        {thresholdMinor > 0 && (
          <ReferenceLine y={thresholdMinor} stroke={colors.warning} strokeDasharray="4 4" strokeOpacity={0.7} />
        )}
        {/* Linea dello zero (scoperto) */}
        {hasNegative && <ReferenceLine y={0} stroke={colors.danger} strokeDasharray="2 2" />}
        {/* Giorno del minimo */}
        <ReferenceLine x={shortDate(minDate)} stroke={colors.axis} strokeOpacity={0.4} strokeDasharray="3 3" />

        <Area
          type="monotone" dataKey="balanceMinor" stroke={stroke} strokeWidth={2}
          fill="url(#cashProjGrad)"
          dot={(props: { cx?: number; cy?: number; payload?: CashProjectionPoint; index?: number }) => {
            const { cx, cy, payload, index } = props
            if (cx == null || cy == null || !payload?.events.length) {
              return <g key={index} />
            }
            const hasOut = payload.events.some(e => e.direction === 'out')
            return (
              <circle key={index} cx={cx} cy={cy} r={3}
                fill={hasOut ? colors.danger : colors.brand} stroke={colors.tipBg} strokeWidth={1} />
            )
          }}
          activeDot={{ r: 4, fill: stroke, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
