'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { Position } from '@/lib/investments/fifo'
import { useTheme } from '@/components/providers/ThemeProvider'

interface Props {
  positions: Position[]
}

// Palette distinguibile in light/dark; 8 colori, si ripete se ci sono più strumenti.
const PALETTE = [
  '#059669', // emerald-600
  '#0891b2', // cyan-600
  '#7c3aed', // violet-600
  '#d97706', // amber-600
  '#dc2626', // red-600
  '#0284c7', // sky-600
  '#65a30d', // lime-600
  '#db2777', // pink-600
]

function formatVal(minor: number, currency: string): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  })
}

// Tronca nomi lunghi per la legenda.
function shortName(name: string): string {
  return name.length > 22 ? name.slice(0, 20) + '…' : name
}

export default function AllocationChart({ positions }: Props) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const active = positions.filter(
    (p) => parseFloat(p.remainingQty) > 0 && (p.marketValueMinor ?? p.costBasisMinor) > 0,
  )

  if (active.length === 0) {
    return (
      <p className="text-sm text-[--muted] py-4 text-center">
        Nessuna posizione aperta con valore disponibile.
      </p>
    )
  }

  const data = active.map((p) => ({
    name:     shortName(p.name),
    fullName: p.name,
    value:    p.marketValueMinor ?? p.costBasisMinor,
    currency: p.currency,
    symbol:   p.symbol,
  }))

  const total = data.reduce((s, d) => s + d.value, 0)
  const singleCurrency = data.every((d) => d.currency === data[0].currency) ? data[0].currency : null

  const tooltipStyle = {
    background:   isDark ? '#1a2421' : '#ffffff',
    border:       `1px solid ${isDark ? 'oklch(0.26 0.01 160)' : 'oklch(0.88 0.005 160)'}`,
    borderRadius: 10,
    fontSize:     12,
    boxShadow:    '0 4px 12px oklch(0 0 0 / 0.12)',
  }

  return (
    <div className="relative w-full">
      {/* Totale al centro della ciambella — solo se le posizioni condividono la stessa valuta */}
      {singleCurrency && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" style={{ paddingBottom: 40 }}>
          <span className="text-[10px] font-medium uppercase tracking-widest text-[--faint]">Totale</span>
          <span className="font-mono tabular-nums text-lg font-semibold text-[--ink]">
            {formatVal(total, singleCurrency)}
          </span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius="52%"
            outerRadius="72%"
            paddingAngle={2}
            startAngle={90}
            endAngle={-270}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} strokeWidth={0} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, _name, props) => {
              const d = props.payload as typeof data[0]
              const pct = ((Number(value) / total) * 100).toFixed(1)
              return [`${formatVal(Number(value), d.currency)} (${pct}%)`, d.fullName]
            }}
            contentStyle={tooltipStyle}
            itemStyle={{ color: isDark ? '#d1fae5' : '#065f46' }}
            labelStyle={{ color: isDark ? 'oklch(0.62 0.01 160)' : 'oklch(0.45 0.01 160)' }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span style={{ fontSize: 12, color: isDark ? 'oklch(0.75 0.01 160)' : 'oklch(0.35 0.01 160)' }}>
                {value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
