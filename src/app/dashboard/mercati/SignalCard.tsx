// src/app/dashboard/mercati/SignalCard.tsx — Card di un singolo indicatore.
// Mostra: valore + percentile, il GRAFICO che spiega l'etichetta, il verdetto,
// la frase del "perché", e il link alla fonte. Server Component (incorpora il
// grafico client MarketChart).
import { Card, Badge } from '@/components/ui'
import type { CachedSignal } from '@/lib/marketOverview/cache'
import { LEVEL_BADGE } from './meta'
import MarketChart from './MarketChart'
import SourceLink from './SourceLink'

function fmtValue(value: number, unit: string): string {
  const n = value.toLocaleString('it-IT', { maximumFractionDigits: 2 })
  if (unit === '$' || unit === '€') return `${unit}${n}`
  return unit ? `${n} ${unit}` : n
}

function fmtDate(epoch: number): string {
  return new Date(epoch * 1000).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function SignalCard({ signal }: { signal: CachedSignal }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-[--ink] text-wrap-balance">{signal.title}</h3>
        {signal.level && (
          <Badge variant={LEVEL_BADGE[signal.level]} className="shrink-0">
            {signal.level === 'high' ? 'Alto' : signal.level === 'low' ? 'Basso' : 'Normale'}
          </Badge>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold font-mono tabular-nums text-[--ink]">
          {fmtValue(signal.value, signal.unit)}
        </span>
        {signal.percentile !== null && (
          <span className="text-xs text-[--muted] font-mono tabular-nums">
            {Math.round(signal.percentile)}° percentile · {signal.window}
          </span>
        )}
      </div>

      {/* Il grafico che spiega l'etichetta: valore attuale nel range storico. */}
      {signal.series && signal.series.length > 1 && (
        <MarketChart series={signal.series} value={signal.value} unit={signal.unit} level={signal.level} />
      )}

      {/* Verdetto + perché */}
      <div className="space-y-1">
        <p className="text-sm font-medium text-[--ink]">{signal.levelText}</p>
        {signal.explanation && (
          <p className="text-xs text-[--muted] leading-relaxed">{signal.explanation}</p>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-[11px] text-[--faint]">
        <SourceLink source={signal.source} estimated={signal.estimated} />
        <span title="Data dell'ultimo aggiornamento della cache">agg. {fmtDate(signal.cachedAt)}</span>
      </div>
    </Card>
  )
}
