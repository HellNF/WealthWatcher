// src/app/dashboard/mercati/SummaryBlock.tsx — "In sintesi": la risposta in
// dieci secondi, dentro l'hero della pagina. Un riquadro per classe di investimento con la valutazione di
// contesto, cosa la determina e come è cambiata rispetto alla rilevazione
// precedente. Server Component.
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from 'lucide-react'
import type { CachedAnalysis } from '@/lib/marketOverview/cache'
import type { Driver } from '@/lib/marketOverview/analysis/types'
import { comparisonPoint, type StanceHistory } from '@/lib/marketOverview/stanceHistory'
import { StanceMeter } from './StanceMeter'
import { STANCE_META, STANCE_MEANING, STANCE_ORDER } from './meta'
import { fmtIsoDate } from './format'

const SHORT_TITLE: Record<string, string> = {
  equities:    'Azioni',
  bonds:       'Obbligazioni',
  commodities: 'Oro e materie prime',
  crypto:      'Criptovalute',
}

/** I due fattori che pesano di più in ciascuna direzione. */
function keyDrivers(drivers: Driver[], reading: Driver['reading']): string[] {
  return drivers
    .filter((d) => d.reading === reading && Number.isFinite(d.score) && d.weight > 0)
    .sort((a, b) => Math.abs(b.score * b.weight) - Math.abs(a.score * a.weight))
    .slice(0, 2)
    .map((d) => d.label)
}

function Change({ analysis, history }: { analysis: CachedAnalysis; history: StanceHistory }) {
  const prev = comparisonPoint(history[analysis.key] ?? [])
  if (!prev) return <span className="text-xs text-(--muted)">prima rilevazione</span>

  const delta = STANCE_ORDER.indexOf(analysis.stance) - STANCE_ORDER.indexOf(prev.stance)
  const since = fmtIsoDate(prev.d)
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-(--muted)">
        <Minus className="size-3" strokeWidth={1.75} aria-hidden /> invariata dal {since}
      </span>
    )
  }
  const Icon = delta > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className="inline-flex items-center gap-1 text-xs text-(--muted)">
      <Icon className="size-3" strokeWidth={1.75} aria-hidden />
      {delta > 0 ? 'migliorata' : 'peggiorata'}: il {since} era «{STANCE_META[prev.stance].label}»
    </span>
  )
}

/** Frase di verdetto dell'hero: quante classi sono tese, quante favorevoli. */
export function summaryVerdict(analyses: CachedAnalysis[]): { headline: string; detail: string } {
  const name = (a: CachedAnalysis) => (SHORT_TITLE[a.key] ?? a.title).toLowerCase()
  const cautious  = analyses.filter((a) => a.stance === 'caution' || a.stance === 'lean-caution')
  const favorable = analyses.filter((a) => a.stance === 'accumulate' || a.stance === 'lean-accumulate')
  const n = analyses.length

  const headline = cautious.length > favorable.length
    ? `Prevale la cautela: ${cautious.length} classi di investimento su ${n} hanno prezzi tirati rispetto alla loro storia.`
    : favorable.length > cautious.length
      ? `Prevalgono condizioni favorevoli: ${favorable.length} classi di investimento su ${n} sono a sconto rispetto alla loro storia.`
      : 'Quadro misto: nessuna direzione prevale tra le classi di investimento.'

  const parts: string[] = []
  if (favorable.length > 0) parts.push(`Più favorevoli: ${favorable.map(name).join(', ')}.`)
  if (cautious.length > 0)  parts.push(`Più tese: ${cautious.map(name).join(', ')}.`)
  return { headline, detail: parts.join(' ') }
}

/** Le classi di investimento come riquadri dell'hero: ognuno porta alla sua analisi. */
export function SummaryTiles({ analyses, history }: { analyses: CachedAnalysis[]; history: StanceHistory }) {
  return (
    <ul className="flex flex-wrap gap-px bg-(--border) border-t border-(--border)">
      {analyses.map((a) => {
        const pros = keyDrivers(a.drivers, 'favorable')
        const cons = keyDrivers(a.drivers, 'unfavorable')
        return (
          <li key={a.key} className="flex-1 basis-full sm:basis-[calc(50%-1px)] min-[100rem]:basis-0 min-w-0 flex">
            <a
              href={`#analisi-${a.key}`}
              className="group flex-1 flex flex-col gap-3 p-5 sm:p-6 bg-(--surface) hover:bg-(--surface-2) active:bg-(--surface-2) transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--ring)"
            >
              <span className="flex items-center justify-between gap-2 text-xs font-medium text-(--muted)">
                {SHORT_TITLE[a.key] ?? a.title}
                <ArrowRight className="size-3.5 text-(--faint) transition-[color,transform] duration-200 ease-out-strong group-hover:text-(--ink) group-hover:translate-x-0.5" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold font-display leading-none tracking-[-0.02em] text-(--ink) [text-wrap:balance]">
                {STANCE_META[a.stance].label}
              </span>
              <StanceMeter stance={a.stance} showLabel={false} />
              <Change analysis={a} history={history} />
              <span className="text-sm text-(--muted) leading-relaxed">{STANCE_MEANING[a.stance]}</span>
              {(pros.length > 0 || cons.length > 0) && (
                <span className="mt-auto text-xs text-(--muted) leading-relaxed">
                  {cons.length > 0 && <>Pesa a sfavore: {cons.join(', ')}. </>}
                  {pros.length > 0 && <>Pesa a favore: {pros.join(', ')}.</>}
                </span>
              )}
            </a>
          </li>
        )
      })}
    </ul>
  )
}
