// src/app/dashboard/mercati/MacroSection.tsx — "Cosa sta succedendo": il quadro
// macro in cinque temi. Ogni scheda dice in una frase cosa sta accadendo,
// perché interessa a chi investe, e mostra i pochi numeri ufficiali da cui
// nasce la lettura (con grafico a scomparsa e fonte). Server Component.
import { Card, Badge } from '@/components/ui'
import type { MacroIndicator, MacroTheme } from '@/lib/marketOverview/macro'
import { periodLabel } from '@/lib/marketOverview/macro'
import { LazySeriesDetails, SeriesChart } from './LazySeries'
import SourceLink from './SourceLink'
import { TONE_BADGE } from './meta'
import { fmtNum } from './format'

function fmtValue(i: MacroIndicator): string {
  const n = fmtNum(i.value, i.decimals)
  if (i.unit === '%') return `${n}%`
  if (i.unit === '$') return `${n} $`
  return n
}

function IndicatorRow({ i }: { i: MacroIndicator }) {
  return (
    <li className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-(--ink)">{i.title}</span>
        <span className="text-sm font-semibold font-mono tabular-nums text-(--ink) shrink-0">{fmtValue(i)}</span>
      </div>
      <div className="flex items-baseline justify-between gap-3 text-xs text-(--muted)">
        <span>{i.note ?? ''}</span>
        <span className="shrink-0">{periodLabel(i.period)}</span>
      </div>
    </li>
  )
}

function ThemeCard({ theme }: { theme: MacroTheme }) {
  const sources = [...new Set(theme.indicators.map((i) => i.source))]
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h3 className="text-base font-semibold text-(--ink)">{theme.title}</h3>
        <Badge variant={TONE_BADGE[theme.tone]}>{theme.status}</Badge>
      </div>

      <p className="text-sm text-(--ink) leading-relaxed">{theme.summary}</p>

      <p className="text-sm text-(--muted) leading-relaxed">
        <strong className="font-semibold text-(--ink)">Perché ti riguarda. </strong>
        {theme.whyItMatters}
      </p>

      <ul className="divide-y divide-(--border)">
        {theme.indicators.map((i) => <IndicatorRow key={i.code} i={i} />)}
      </ul>

      <LazySeriesDetails
        group={`macro.${theme.key}`}
        className="border-t border-(--border) pt-3"
        summaryClassName="cursor-pointer text-xs font-medium text-(--muted) hover:text-(--ink) select-none"
        summary="Vedi l’andamento negli ultimi 10 anni"
      >
        <div className="space-y-5 pt-4">
          {theme.indicators.map((i) => (
            <div key={i.code} className="space-y-1">
              <p className="text-xs text-(--muted)">{i.title}</p>
              <SeriesChart code={i.code} value={i.value} unit={i.unit === 'pt' ? '' : i.unit} level={null} decimals={i.decimals > 1 ? 2 : 1} />
            </div>
          ))}
        </div>
      </LazySeriesDetails>

      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--muted)">
        {sources.map((s) => <SourceLink key={s} source={s} />)}
      </div>
    </Card>
  )
}

export function MacroSection({ themes }: { themes: MacroTheme[] }) {
  return (
    // flex + grow: l'ultima riga si allarga, mai una scheda sola con il vuoto accanto
    <div className="flex flex-wrap gap-4 [&>*]:flex-1 [&>*]:basis-[30rem] [&>*]:min-w-0">
      {themes.map((t) => <ThemeCard key={t.key} theme={t} />)}
    </div>
  )
}
