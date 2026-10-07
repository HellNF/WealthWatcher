'use client'
// src/app/dashboard/NetWorthHero.tsx — Testata del patrimonio netto con grafico
// "scrubbabile": passando il puntatore (o il dito) sul grafico, il numero in
// alto diventa il valore di quel giorno e la variazione si ricalcola rispetto
// all'inizio del periodo scelto. Il numero risponde 1:1 al gesto, senza tooltip
// da inseguire.
import { useId, useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { motion, LayoutGroup, useReducedMotion } from 'motion/react'
import { Info } from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'
import { Badge, Eyebrow, HeroShell } from '@/components/ui'
import { cn } from '@/lib/cn'

export interface NetWorthPoint {
  /** ISO yyyy-mm-dd */
  date: string
  /** Patrimonio netto in centesimi di euro */
  value: number
}

interface Props {
  points: NetWorthPoint[]
  stale: boolean
  /** Pulsante di ricalcolo (server action) */
  refresh?: React.ReactNode
  /** Composizione del patrimonio, a destra del numero */
  aside?: React.ReactNode
  /** Riga in fondo alla card del grafico */
  footer?: React.ReactNode
  /** id del numero grande, osservato dalla barra compatta */
  valueId?: string
}

const DAY_MS = 86_400_000

const RANGES = [
  { id: '1M',  label: '1M',    days: 30,       phrase: 'nell’ultimo mese' },
  { id: '3M',  label: '3M',    days: 91,       phrase: 'negli ultimi 3 mesi' },
  { id: '6M',  label: '6M',    days: 182,      phrase: 'negli ultimi 6 mesi' },
  { id: '1A',  label: '1A',    days: 365,      phrase: 'nell’ultimo anno' },
  { id: 'ALL', label: 'Tutto', days: Infinity, phrase: 'dall’inizio' },
] as const
type RangeId = (typeof RANGES)[number]['id']

function toTime(iso: string): number {
  return Date.parse(`${iso}T12:00:00Z`)
}

function fmtDay(t: number, withYear = false): string {
  return new Date(t).toLocaleDateString('it-IT', {
    day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'Europe/Rome',
  })
}

function fmtEur(minor: number, decimals = 2): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency', currency: 'EUR', useGrouping: 'always',
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  })
}

function fmtAxisEur(minor: number): string {
  const v = minor / 100
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toLocaleString('it-IT', { maximumFractionDigits: 1 })} M€`
  if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toLocaleString('it-IT', { maximumFractionDigits: 1 })} k€`
  return `${Math.round(v)} €`
}

/** Tacche "tonde" (1/2/2,5/5 × 10ⁿ) che coprono [lo, hi] con circa `count` intervalli. */
function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (hi <= lo) return [lo, lo + 1]
  const raw  = (hi - lo) / count
  const mag  = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!
  const out: number[] = []
  for (let v = Math.floor(lo / step) * step; v < hi + step; v += step) out.push(v)
  return out
}

export default function NetWorthHero({ points, stale, refresh, aside, footer, valueId }: Props) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const reduceMotion = useReducedMotion()
  const groupId = useId()

  const [range, setRange] = useState<RangeId>('ALL')
  const [scrub, setScrub] = useState<number | null>(null)

  const all = useMemo(() => points.map((p) => ({ t: toTime(p.date), value: p.value })), [points])
  const latest = all.at(-1) ?? null

  // Punti del periodo. Se il periodo parte "in mezzo" a due rilevazioni, tiene
  // anche l'ultima precedente: è la base onesta su cui misurare la variazione.
  const data = useMemo(() => {
    if (!latest) return []
    const days = RANGES.find((r) => r.id === range)!.days
    if (days === Infinity) return all
    const from = latest.t - days * DAY_MS
    const firstIn = all.findIndex((p) => p.t >= from)
    return all.slice(Math.max(0, firstIn - (all[firstIn]?.t === from ? 0 : 1)))
  }, [all, latest, range])

  if (!latest) {
    return (
      <HeroShell innerClassName="p-6 gap-3">
        <h1><Eyebrow>Patrimonio netto</Eyebrow></h1>
        <p className="text-sm text-(--muted)">Calcolo in corso…</p>
      </HeroShell>
    )
  }

  const base    = data[0]
  const active  = scrub !== null && data[scrub] ? data[scrub] : null
  const shown   = active ?? latest
  const delta   = shown.value - base.value
  const pct     = base.value > 0 ? (delta / base.value) * 100 : null
  const hasChart = data.length >= 2
  // Sul primo punto del periodo non c'è variazione da mostrare: solo la data
  const atBase = active !== null && active.t === base.t
  const rangeMeta = RANGES.find((r) => r.id === range)!

  const first = base.t
  const last  = data[data.length - 1].t
  const X_TICKS = 5
  const xTicks = last - first < DAY_MS * X_TICKS
    ? data.map((d) => d.t)
    : Array.from({ length: X_TICKS }, (_, i) => first + ((last - first) * i) / (X_TICKS - 1))

  const values = data.map((d) => d.value)
  const yMax = Math.max(...values)
  const yMin = Math.min(...values)
  // Con "Tutto" l'asse parte da zero (la scala intera è il messaggio); sui
  // periodi brevi si stringe sui dati, altrimenti la variazione sparisce.
  const yLo = range === 'ALL' ? (yMin < -0.02 * Math.abs(yMax) ? yMin : 0) : yMin
  const yTicks = niceTicks(yLo, yMax)

  const colors = isDark
    ? { brand: '#34d399', grid: 'oklch(0.28 0.01 160)', axis: 'oklch(0.72 0.01 160)' }
    : { brand: '#059669', grid: 'oklch(0.90 0.005 160)', axis: 'oklch(0.45 0.01 160)' }

  return (
    // Un'unica card: numero, variazione, periodo e grafico leggono come un blocco solo.
    // Su desktop si allunga fino a pareggiare la colonna laterale.
    <HeroShell className="xl:flex-1">
      <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-2 space-y-5">
        <div className="flex items-start justify-between gap-x-6 gap-y-4 flex-wrap">
          <div className="space-y-4 min-w-0">
            <h1><Eyebrow>Patrimonio netto</Eyebrow></h1>
            <p
              id={valueId}
              className="text-5xl sm:text-7xl font-extrabold font-display tabular-nums text-(--ink) leading-none tracking-[-0.03em]"
              aria-live="off"
            >
              {fmtEur(shown.value)}
            </p>
            <div className="flex items-center gap-x-2 gap-y-1 flex-wrap min-h-6 text-sm text-(--muted)">
              {data.length >= 2 && !atBase && (
                delta === 0 ? (
                  <span>Invariato</span>
                ) : (
                  <Badge variant={delta > 0 ? 'gain' : 'loss'} className="font-mono tabular-nums">
                    {delta > 0 ? '+' : '−'}{fmtEur(Math.abs(delta), 0)}
                    {pct !== null && (
                      <> ({delta > 0 ? '+' : '−'}{Math.abs(pct).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)</>
                    )}
                  </Badge>
                )
              )}
              <span>
                {atBase
                  ? fmtDay(base.t, true)
                  : active
                    ? `dal ${fmtDay(base.t)} al ${fmtDay(active.t, true)}`
                    : data.length >= 2 ? rangeMeta.phrase : null}
              </span>
              <span aria-hidden className="text-(--faint)">·</span>
              <span className={cn('inline-flex items-center gap-1.5', stale && 'text-(--warning-text)')}>
                {stale && <Info className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />}
                {stale ? 'Dati parziali, aggiornato' : 'Aggiornato'} il {fmtDay(latest.t, true)}
                {refresh}
              </span>
            </div>
          </div>

          {all.length >= 2 && (
              <div className="shrink-0">
                <LayoutGroup id={groupId}>
                  <div
                    role="radiogroup"
                    aria-label="Periodo del grafico"
                    className="inline-flex items-center gap-0.5 rounded-lg bg-(--surface-2) p-0.5"
                  >
                    {RANGES.map((r) => {
                      const selected = r.id === range
                      return (
                        <button
                          key={r.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => { setRange(r.id); setScrub(null) }}
                          className={cn(
                            'relative h-7 pointer-coarse:h-9 min-w-10 px-2.5 rounded-md text-xs font-medium cursor-pointer select-none',
                            'transition-[color,transform] duration-150 ease-out-strong active:scale-[0.96]',
                            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--ring)',
                            selected ? 'text-(--ink)' : 'text-(--muted) hover:text-(--ink)',
                          )}
                        >
                          {selected && (
                            <motion.span
                              layoutId="networth-range-pill"
                              className="absolute inset-0 rounded-md bg-(--surface) shadow-(--shadow-sm) ring-1 ring-(--border)"
                              transition={reduceMotion ? { duration: 0 } : { type: 'spring', duration: 0.3, bounce: 0 }}
                            />
                          )}
                          <span className="relative">{r.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </LayoutGroup>
              </div>
            )}
        </div>

        {aside}
      </div>



      <div className="px-3 sm:px-5 pt-2 pb-1 flex flex-col xl:flex-1">
        {hasChart ? (
          <div className="h-[260px] xl:h-auto xl:flex-1 xl:min-h-[260px] xl:max-h-[520px] relative touch-pan-y select-none [&_.recharts-surface]:outline-none">
            <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 8, right: 4, left: 0, bottom: 4 }}
                onMouseMove={(s) => setScrub(s.isTooltipActive && s.activeTooltipIndex != null ? Number(s.activeTooltipIndex) : null)}
                onMouseLeave={() => setScrub(null)}
                onTouchMove={(s) => setScrub(s.isTooltipActive && s.activeTooltipIndex != null ? Number(s.activeTooltipIndex) : null)}
                onTouchEnd={() => setScrub(null)}
              >
                <defs>
                  <linearGradient id={`${groupId}-grad`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={colors.brand} stopOpacity={isDark ? 0.3 : 0.2} />
                    <stop offset="100%" stopColor={colors.brand} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={[first, last]}
                  ticks={xTicks}
                  tickFormatter={(t) => fmtDay(Number(t))}
                  tick={{ fill: colors.axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  padding={{ left: 8, right: 16 }}
                />
                <YAxis
                  tickFormatter={(v) => fmtAxisEur(Number(v))}
                  tick={{ fill: colors.axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  ticks={yTicks}
                  domain={[yTicks[0], yTicks[yTicks.length - 1]]}
                  allowDataOverflow
                  width={56}
                />
                {/* Nessun riquadro: il valore vive nel numero grande in alto */}
                <Tooltip
                  content={() => null}
                  cursor={{ stroke: colors.axis, strokeWidth: 1, strokeOpacity: 0.6 }}
                  isAnimationActive={false}
                />
                <Area
                  type="monotoneX"
                  dataKey="value"
                  stroke={colors.brand}
                  strokeWidth={2}
                  fill={`url(#${groupId}-grad)`}
                  dot={false}
                  activeDot={{ r: 4.5, fill: colors.brand, stroke: isDark ? 'oklch(0.17 0.007 160)' : '#fff', strokeWidth: 2 }}
                  isAnimationActive={!reduceMotion}
                  animationDuration={350}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <p className="text-sm text-(--muted) py-10 text-center">
            Il grafico si popola nei prossimi giorni: servono almeno due rilevazioni.
          </p>
        )}
      </div>
      {footer}
    </HeroShell>
  )
}
