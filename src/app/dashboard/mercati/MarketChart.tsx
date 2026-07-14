'use client'

// src/app/dashboard/mercati/MarketChart.tsx — Grafico che SPIEGA l'etichetta.
// Mostra la serie storica della finestra dichiarata e una linea di riferimento
// sul valore attuale: si vede a colpo d'occhio se "oggi" è in cima, in fondo o
// a metà del range storico — cioè da dove nasce il percentile/verdetto.
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { useTheme } from '@/components/providers/ThemeProvider'
import type { SeriesPoint, SignalLevel } from '@/lib/marketOverview/signals'

interface Props {
  series: SeriesPoint[]
  value:  number
  unit:   string
  level:  SignalLevel | null
}

function shortLabel(t: string): string {
  // 'YYYY-MM-DD' | 'YYYY-MM' → "MM/YY"
  const [y, m] = t.split('-')
  return m ? `${m}/${y.slice(2)}` : y
}

function fmtVal(v: number, unit: string): string {
  const n = v.toLocaleString('it-IT', { maximumFractionDigits: 2 })
  if (unit === '$' || unit === '€') return `${unit}${n}`
  return unit ? `${n} ${unit}` : n
}

export default function MarketChart({ series, value, unit, level }: Props) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  if (series.length < 2) return null

  // Accento coerente col livello: alto = ambra, basso = blu, normale/neutro = brand.
  const accent = isDark
    ? { high: '#fbbf24', low: '#60a5fa', normal: '#34d399' }
    : { high: '#d97706', low: '#2563eb', normal: '#059669' }
  const stroke = level ? accent[level] : accent.normal

  const colors = isDark
    ? { grid: '#262626', axis: '#a3a3a3', tipBg: '#1a2421', tipBorder: '#2d3d38', tipLabel: '#a3a3a3', ink: '#e5e5e5' }
    : { grid: '#e5e5e5', axis: '#6b7280', tipBg: '#ffffff', tipBorder: '#e5e7eb', tipLabel: '#6b7280', ink: '#171717' }

  const data = series.map((p) => ({ label: shortLabel(p.t), v: p.v }))
  const gradId = `mktGrad-${Math.abs(hashString(stroke + series.length))}`

  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={stroke} stopOpacity={isDark ? 0.30 : 0.20} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
        <XAxis
          dataKey="label" tick={{ fill: colors.axis, fontSize: 10 }}
          tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={44}
        />
        <YAxis
          tick={{ fill: colors.axis, fontSize: 10 }} tickLine={false} axisLine={false}
          width={40} domain={['auto', 'auto']}
          tickFormatter={(v) => v.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
        />
        <Tooltip
          cursor={{ stroke: colors.grid, strokeWidth: 1 }}
          content={(props) => {
            const { active, payload } = props as unknown as { active?: boolean; payload?: { payload?: { label: string; v: number } }[] }
            const p = active && payload?.length ? payload[0]?.payload : undefined
            if (!p) return null
            return (
              <div style={{ background: colors.tipBg, border: `1px solid ${colors.tipBorder}`, borderRadius: 8, fontSize: 11, padding: '6px 8px' }}>
                <span style={{ color: colors.tipLabel }}>{p.label}</span>{' · '}
                <span style={{ color: colors.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtVal(p.v, unit)}</span>
              </div>
            )
          }}
        />
        {/* Linea "ora": il valore attuale rispetto all'intero range storico. */}
        <ReferenceLine
          y={value} stroke={stroke} strokeDasharray="4 3" strokeOpacity={0.9}
          label={{ value: 'ora', position: 'insideTopRight', fill: stroke, fontSize: 10 }}
        />
        <Area type="monotone" dataKey="v" stroke={stroke} strokeWidth={2} fill={`url(#${gradId})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// Hash stabile per un id gradiente univoco per card (evita collisioni di <defs>).
function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}
