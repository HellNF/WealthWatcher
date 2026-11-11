'use client'
// src/app/dashboard/NetWorthHero.tsx — Testata del patrimonio netto con grafico
// "scrubbabile": passando il puntatore (o il dito) sul grafico, il numero in
// alto diventa il valore di quel giorno e la variazione si ricalcola rispetto
// all'inizio del periodo scelto. Il numero risponde 1:1 al gesto, senza tooltip
// da inseguire.
import { formatAxisMoney, fmtEur } from '@/lib/format'
import { useId, useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Segmented } from '@/components/ui/Segmented'
import { useReducedMotion } from '@/components/ui/useReducedMotion'
import { Info } from 'lucide-react'
import NumberFlow from '@number-flow/react'
import { useChartTheme } from '@/components/charts/chartTheme'
import { Badge, Eyebrow, HeroShell, HeroFigure } from '@/components/ui'
import { cn } from '@/lib/cn'

export interface NetWorthPoint {
  /** ISO yyyy-mm-dd */
  date: string
  /** Patrimonio netto in centesimi di euro */
  value: number
  stale?: boolean
  /** Stima a posteriori da movimenti, prezzi e valutazioni salvati (non una rilevazione) */
  reconstructed?: boolean
}

interface Props {
  points: NetWorthPoint[]
  stale: boolean
  /** Pulsante di ricalcolo (server action) */
  refresh?: React.ReactNode
  /** Azione accanto al titolo (es. il pulsante della modalità privacy). */
  headerAction?: React.ReactNode
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

export default function NetWorthHero({ points, stale, refresh, headerAction, aside, footer, valueId }: Props) {
  const t = useChartTheme()
  const reduceMotion = useReducedMotion()
  const groupId = useId()

  const [range, setRange] = useState<RangeId>('ALL')
  const [scrub, setScrub] = useState<number | null>(null)

  // Due serie sullo stesso asse: `estimated` (ricostruita, tratteggiata) e
  // `observed` (snapshot veri). Il primo snapshot porta anche il valore stimato
  // così il tratteggio si aggancia alla linea piena senza buchi.
  const all = useMemo(() => points.map((p, i) => {
    const reconstructed = p.reconstructed ?? false
    const joinsEstimate = !reconstructed && (points[i - 1]?.reconstructed ?? false)
    return {
      t: toTime(p.date), value: p.value, stale: p.stale ?? false, reconstructed,
      observed:  reconstructed ? null : p.value,
      estimated: reconstructed || joinsEstimate ? p.value : null,
    }
  }), [points])
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
  // Colonna dell'asse larga quanto l'etichetta più lunga (≈7px a carattere a 11px, più margine): mai etichette su due righe.
  const yAxisWidth = Math.max(48, Math.max(...yTicks.map((t) => formatAxisMoney(t).length)) * 7 + 12)


  return (
    // Un'unica card: numero, variazione, periodo e grafico leggono come un blocco solo.
    // Su desktop si allunga fino a pareggiare la colonna laterale.
    <HeroShell className="xl:flex-1">
      <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-2 space-y-5">
        <div className="flex items-start justify-between gap-x-6 gap-y-4 flex-wrap">
          <div className="space-y-4 min-w-0">
            <div className="flex items-center gap-2 -my-1.5">
              <h1><Eyebrow>Patrimonio netto</Eyebrow></h1>
              {headerAction}
            </div>
            {/* Le cifre scorrono quando il valore cambia da solo (ricalcolo, fine dello
                scrub); durante lo scrub seguono il dito 1:1, senza animazione. */}
            <HeroFigure id={valueId} value={fmtEur(shown.value)} size="xl" className="text-(--ink)" aria-live="off">
              <NumberFlow
                value={shown.value / 100}
                locales="it-IT"
                format={{ style: 'currency', currency: 'EUR', useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                animated={scrub === null}
                transformTiming={{ duration: 550, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
                spinTiming={{ duration: 550, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
              />
            </HeroFigure>
            <div className="flex items-center gap-x-2 gap-y-1 flex-wrap min-h-6 text-sm text-(--muted)">
              {data.length >= 2 && !atBase && (
                shown.stale || base.stale ? (<span className="text-(--muted)">Variazione non confrontabile: dati incompleti o da verificare</span>) : delta === 0 ? (
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
                {stale || shown.stale ? 'Dati incompleti o da verificare · calcolo' : 'Calcolo'} il {fmtDay(latest.t, true)}
                {refresh}
              </span>
              {(shown.reconstructed || base.reconstructed) && data.length >= 2 && (
                <span className="text-(--muted)">· {shown.reconstructed ? 'valore ricostruito dai movimenti' : 'base ricostruita dai movimenti'}</span>
              )}
            </div>
          </div>

          {all.length >= 2 && (
              <div className="shrink-0">
                <Segmented
                  label="Periodo del grafico"
                  size="sm"
                  value={range}
                  onChange={(r) => { setRange(r); setScrub(null) }}
                  options={RANGES.map((r) => ({ value: r.id, label: r.label }))}
                />
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
                    <stop offset="0%"   stopColor={t.brand} stopOpacity={t.dark ? 0.3 : 0.2} />
                    <stop offset="100%" stopColor={t.brand} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={[first, last]}
                  ticks={xTicks}
                  tickFormatter={(t) => fmtDay(Number(t))}
                  tick={t.tick}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  padding={{ left: 8, right: 16 }}
                />
                <YAxis
                  tickFormatter={(v) => formatAxisMoney(Number(v))}
                  tick={t.tick}
                  tickLine={false}
                  axisLine={false}
                  ticks={yTicks}
                  domain={[yTicks[0], yTicks[yTicks.length - 1]]}
                  allowDataOverflow
                  width={yAxisWidth}
                />
                {/* Nessun riquadro: il valore vive nel numero grande in alto */}
                <Tooltip
                  content={() => null}
                  cursor={{ stroke: t.axis, strokeWidth: 1, strokeOpacity: 0.6 }}
                  isAnimationActive={false}
                />
                <Area
                  type="monotoneX"
                  dataKey="estimated"
                  stroke={t.brand}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                  fill={`url(#${groupId}-grad)`}
                  fillOpacity={0.45}
                  dot={false}
                  activeDot={{ r: 4.5, fill: t.brand, stroke: t.dark ? 'oklch(0.17 0.007 160)' : '#fff', strokeWidth: 2 }}
                  isAnimationActive={!reduceMotion}
                  animationDuration={350}
                  animationEasing="ease-out"
                />
                <Area
                  type="monotoneX"
                  dataKey="observed"
                  stroke={t.brand}
                  strokeWidth={2}
                  fill={`url(#${groupId}-grad)`}
                  dot={false}
                  activeDot={{ r: 4.5, fill: t.brand, stroke: t.dark ? 'oklch(0.17 0.007 160)' : '#fff', strokeWidth: 2 }}
                  isAnimationActive={!reduceMotion}
                  animationDuration={350}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
            </div>
          </div>
        ) : null}
        {hasChart && data.some((d) => d.reconstructed) && (
          <p className="px-3 pt-1 text-xs text-(--muted)">
            Tratteggio: stima ricostruita da movimenti, prezzi e valutazioni salvati, prima della prima rilevazione.
            I conti senza movimenti sono considerati costanti; i beni eliminati non sono inclusi.
          </p>
        )}
        {!hasChart && (
          <p className="text-sm text-(--muted) py-10 text-center">
            Il grafico si popola nei prossimi giorni: servono almeno due rilevazioni.
          </p>
        )}
      </div>
      {footer}
    </HeroShell>
  )
}
