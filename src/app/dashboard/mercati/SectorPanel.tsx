// src/app/dashboard/mercati/SectorPanel.tsx — Pannello di sintesi di un settore:
// stance + confidenza, paragrafo argomentato, driver pro/cautela (ognuno con
// fonte), sotto-mercati, link di approfondimento e — a scomparsa — i grafici
// degli indicatori. Server Component.
import { ChevronRight, ExternalLink } from 'lucide-react'
import { Card, Badge } from '@/components/ui'
import type { CachedAnalysis } from '@/lib/marketOverview/cache'
import type { CachedSignal } from '@/lib/marketOverview/cache'
import type { Driver } from '@/lib/marketOverview/analysis/types'
import { StanceMeter } from './StanceMeter'
import { SignalCard } from './SignalCard'
import { LazySeriesDetails } from './LazySeries'
import SourceLink from './SourceLink'
import { STANCE_META, STANCE_MEANING, CONFIDENCE_LABEL, READING_STYLE } from './meta'

function DriverRow({ d }: { d: Driver }) {
  const missing = d.weight === 0 || !Number.isFinite(d.score)
  const style = missing ? READING_STYLE.neutral : READING_STYLE[d.reading]
  return (
    <li className="flex items-start gap-2 py-1.5">
      <span className="mt-1.5 size-2 rounded-full shrink-0" style={{ background: style.dot }} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-(--ink)">{d.label}</span>
          <span className="text-xs font-mono tabular-nums text-(--muted) shrink-0">{d.detail}</span>
        </div>
        {d.explain && <p className="text-xs text-(--muted) leading-relaxed mt-0.5 max-w-[70ch]">{d.explain}</p>}
        {d.source !== 'sintesi' && (
          <span className="text-xs text-(--muted)">{d.source}</span>
        )}
      </div>
    </li>
  )
}

export function SectorPanel({ analysis, signals }: { analysis: CachedAnalysis; signals: CachedSignal[] }) {
  const drivers = analysis.drivers.filter((d) => d.source !== 'sintesi') // i "driver-sottomercato" li mostriamo a parte
  const asDate = new Date(analysis.cachedAt * 1000).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <Card id={`analisi-${analysis.key}`} className="space-y-5 scroll-mt-20">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h3 className="text-lg font-semibold text-(--ink)">{analysis.title}</h3>
          <Badge variant="neutral">{CONFIDENCE_LABEL[analysis.confidence]}</Badge>
        </div>
        <div className="max-w-md">
          <StanceMeter stance={analysis.stance} />
        </div>
        <p className="text-sm text-(--ink) leading-relaxed max-w-[75ch]">{STANCE_MEANING[analysis.stance]}</p>
      </div>

      {/* Narrativa argomentata */}
      <p className="text-sm text-(--muted) leading-relaxed max-w-[75ch]">{analysis.narrative}</p>

      {/* Driver: cosa porta alla conclusione */}
      {drivers.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-(--ink) mb-1">Cosa entra nella valutazione</h4>
          <ul className="divide-y divide-(--border)">
            {drivers.map((d, i) => <DriverRow key={`${d.label}-${i}`} d={d} />)}
          </ul>
        </div>
      )}

      {/* Sotto-mercati (azionario per area/Tech, titoli USA, commodities leggere) */}
      {analysis.subMarkets && analysis.subMarkets.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-(--ink) mb-1">Nel dettaglio</h4>
          <ul className="divide-y divide-(--border)">
            {analysis.subMarkets.map((sub) => (
              <li key={sub.key} className="py-2.5">
                <details className="group">
                  <summary className="grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,1fr)_10rem_9.5rem] items-center gap-x-4 gap-y-1.5 cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-1.5 text-sm text-(--ink) min-w-0">
                      <ChevronRight className="size-3.5 shrink-0 text-(--muted) transition-transform duration-150 group-open:rotate-90" strokeWidth={1.75} aria-hidden />
                      <span className="truncate">{sub.title}</span>
                    </span>
                    <span className="hidden sm:block"><StanceMeter stance={sub.stance} showLabel={false} /></span>
                    <span className="text-xs font-semibold text-right" style={{ color: STANCE_META[sub.stance].color }}>
                      {STANCE_META[sub.stance].label}
                    </span>
                  </summary>
                  <ul className="pt-2 pl-5">
                    {sub.drivers.map((d, i) => (
                      <li key={`${d.label}-${i}`} className="flex items-baseline justify-between gap-3 py-1 text-xs">
                        <span className="flex items-baseline gap-1.5 text-(--muted)">
                          <span className="size-1.5 rounded-full shrink-0 -translate-y-px" style={{ background: (d.weight === 0 ? READING_STYLE.neutral : READING_STYLE[d.reading]).dot }} aria-hidden />
                          {d.label}
                        </span>
                        <span className="font-mono tabular-nums text-(--muted) text-right">{d.detail}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
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
              className="group inline-flex items-center gap-1.5 text-xs text-(--brand-text) hover:underline"
            >
              {l.label}
              <ExternalLink className="size-3 opacity-70 group-hover:opacity-100" strokeWidth={1.75} aria-hidden />
            </a>
          ))}
        </div>
      )}

      {/* Grafici degli indicatori a scomparsa */}
      {signals.length > 0 && (
        <LazySeriesDetails
          group={analysis.key}
          className="border-t border-(--border) pt-3"
          summaryClassName="cursor-pointer text-sm font-medium text-(--muted) hover:text-(--ink) select-none"
          summary={`Vedi i grafici degli indicatori (${signals.length})`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
            {signals.map((s) => <SignalCard key={s.code} signal={s} />)}
          </div>
        </LazySeriesDetails>
      )}

      <div className="flex items-center justify-between gap-2 text-xs text-(--muted) border-t border-(--border) pt-3">
        <SourceLink source={drivers[0]?.source ?? 'Yahoo Finance'} />
        <span>aggiornato al {asDate}</span>
      </div>
    </Card>
  )
}
