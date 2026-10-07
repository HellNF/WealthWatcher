'use client'

// src/app/dashboard/mercati/LazySeries.tsx — Grafici caricati solo quando
// servono. Le serie storiche non sono nella pagina né nel database: aprendo un
// gruppo di grafici vengono chieste al server, che le scarica dalla fonte.
//
//   <LazySeriesDetails group="bonds" summary="…">   ← <details> che carica all'apertura
//     … <SeriesChart code="bonds.it10y" … /> …      ← ovunque nei figli (anche server component)
//   </LazySeriesDetails>
import { createContext, useContext, useState } from 'react'
import type { SeriesPoint, SignalLevel } from '@/lib/marketOverview/signals'
import MarketChart from './MarketChart'

type State =
  | { status: 'idle' | 'loading' | 'error' }
  | { status: 'ready'; series: Record<string, SeriesPoint[]> }

const SeriesContext = createContext<State>({ status: 'idle' })

interface DetailsProps {
  group:      string
  summary:    React.ReactNode
  children:   React.ReactNode
  className?: string
  summaryClassName?: string
}

export function LazySeriesDetails({ group, summary, children, className, summaryClassName }: DetailsProps) {
  const [state, setState] = useState<State>({ status: 'idle' })

  async function load() {
    setState({ status: 'loading' })
    try {
      const res = await fetch(`/api/markets/series?group=${encodeURIComponent(group)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as { series: Record<string, SeriesPoint[]> }
      setState({ status: 'ready', series: json.series })
    } catch (e) {
      console.error(`[mercati] grafici "${group}" non caricati:`, e)
      setState({ status: 'error' })
    }
  }

  return (
    <details
      className={className}
      onToggle={(e) => { if (e.currentTarget.open && (state.status === 'idle' || state.status === 'error')) void load() }}
    >
      <summary className={summaryClassName}>{summary}</summary>
      {state.status === 'error' && (
        <p role="alert" className="pt-3 text-xs text-(--warning-text)">
          Non riesco a scaricare i grafici dalla fonte in questo momento.{' '}
          <button type="button" onClick={() => void load()} className="underline underline-offset-2">Riprova</button>
        </p>
      )}
      <SeriesContext.Provider value={state}>{children}</SeriesContext.Provider>
    </details>
  )
}

interface ChartProps {
  code:      string
  value:     number
  unit:      string
  level:     SignalLevel | null
  decimals?: number
}

/** Il grafico di un indicatore dentro un LazySeriesDetails. Nulla se la fonte non ha una serie per quel codice. */
export function SeriesChart({ code, value, unit, level, decimals }: ChartProps) {
  const state = useContext(SeriesContext)
  if (state.status === 'error') return null
  if (state.status !== 'ready') {
    return <div className="h-[140px] w-full animate-pulse rounded-lg bg-(--surface-2)" aria-label="Caricamento del grafico" />
  }
  const series = state.series[code]
  if (!series || series.length < 2) return null
  return <MarketChart series={series} value={value} unit={unit} level={level} decimals={decimals} />
}
