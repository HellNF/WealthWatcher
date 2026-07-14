// src/app/dashboard/mercati/SectorPanel.tsx — Pannello di sintesi di un settore:
// stance + confidenza, paragrafo argomentato, driver pro/cautela (ognuno con
// fonte), sotto-mercati, link di approfondimento e — a scomparsa — i grafici
// degli indicatori. Server Component.
import { ExternalLink } from 'lucide-react'
import { Card, Badge } from '@/components/ui'
import type { CachedAnalysis } from '@/lib/marketOverview/cache'
import type { CachedSignal } from '@/lib/marketOverview/cache'
import type { Driver } from '@/lib/marketOverview/analysis/types'
import { StanceMeter } from './StanceMeter'
import { SignalCard } from './SignalCard'
import SourceLink from './SourceLink'
import { STANCE_META, CONFIDENCE_LABEL, READING_STYLE } from './meta'

function DriverRow({ d }: { d: Driver }) {
  const missing = d.weight === 0 || !Number.isFinite(d.score)
  const style = missing ? READING_STYLE.neutral : READING_STYLE[d.reading]
  return (
    <li className="flex items-start gap-2 py-1.5">
      <span className="mt-1.5 size-2 rounded-full shrink-0" style={{ background: style.dot }} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-[--ink]">{d.label}</span>
          <span className="text-xs font-mono tabular-nums text-[--muted] shrink-0">{d.detail}</span>
        </div>
        {d.source !== 'sintesi' && (
          <span className="text-[10px] text-[--faint]">{d.source}</span>
        )}
      </div>
    </li>
  )
}

export function SectorPanel({ analysis, signals }: { analysis: CachedAnalysis; signals: CachedSignal[] }) {
  const meta = STANCE_META[analysis.stance]
  const drivers = analysis.drivers.filter((d) => d.source !== 'sintesi') // i "driver-sottomercato" li mostriamo a parte
  const asDate = new Date(analysis.cachedAt * 1000).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <Card className="space-y-5">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h3 className="text-lg font-semibold text-[--ink]">{analysis.title}</h3>
          <Badge variant={meta.badge}>{CONFIDENCE_LABEL[analysis.confidence]}</Badge>
        </div>
        <div className="max-w-md">
          <StanceMeter stance={analysis.stance} />
        </div>
      </div>

      {/* Narrativa argomentata */}
      <p className="text-sm text-[--muted] leading-relaxed">{analysis.narrative}</p>

      {/* Driver: cosa porta alla conclusione */}
      {drivers.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[--faint] mb-1">Cosa entra nella valutazione</p>
          <ul className="divide-y divide-[--border]">
            {drivers.map((d, i) => <DriverRow key={`${d.label}-${i}`} d={d} />)}
          </ul>
        </div>
      )}

      {/* Sotto-mercati (azionario per area/Tech, commodities leggere) */}
      {analysis.subMarkets && analysis.subMarkets.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[--faint] mb-2">Dettaglio</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {analysis.subMarkets.map((sub) => (
              <div key={sub.key} className="rounded-lg border border-[--border] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[--ink]">{sub.title}</span>
                  <span className="text-xs font-semibold" style={{ color: STANCE_META[sub.stance].color }}>
                    {STANCE_META[sub.stance].label}
                  </span>
                </div>
                <StanceMeter stance={sub.stance} showLabel={false} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approfondisci */}
      {analysis.learnMore.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
          {analysis.learnMore.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1.5 text-xs text-[--brand-text] hover:underline"
            >
              {l.label}
              <ExternalLink className="size-3 opacity-70 group-hover:opacity-100" strokeWidth={1.75} aria-hidden />
            </a>
          ))}
        </div>
      )}

      {/* Grafici degli indicatori a scomparsa */}
      {signals.length > 0 && (
        <details className="group border-t border-[--border] pt-3">
          <summary className="cursor-pointer text-sm font-medium text-[--muted] hover:text-[--ink] select-none">
            Vedi i grafici degli indicatori ({signals.length})
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
            {signals.map((s) => <SignalCard key={s.code} signal={s} />)}
          </div>
        </details>
      )}

      <div className="flex items-center justify-between gap-2 text-[11px] text-[--faint] border-t border-[--border] pt-3">
        <SourceLink source={drivers[0]?.source ?? 'Yahoo Finance'} />
        <span>aggiornato al {asDate}</span>
      </div>
    </Card>
  )
}
