// src/app/dashboard/tasse/TaxVerdict.tsx — Hero "verdetto fiscale": la risposta in 5 secondi.
// Carico totale in grande + frase in linguaggio naturale + 4 metriche di contorno.
// Componente presentazionale: tutta la logica (headline, leva principale) è calcolata a monte.
// Le imposte sono mostrate in tono neutro: sono un dato, non un allarme.
import { Eyebrow, HeroShell } from '@/components/ui'

export interface VerdictStat {
  label: string
  value: string
  sub?:  string
  /** Mantenuto per compatibilità: il tono non colora più le cifre. */
  tone?: 'danger' | 'ink'
}

interface TaxVerdictProps {
  headline:   string
  detail?:    string
  totalLabel: string
  totalValue: string
  /** id del numero grande, osservato dalla barra compatta */
  valueId?:   string
  stats:      VerdictStat[]
}

export default function TaxVerdict({ headline, detail, totalLabel, totalValue, valueId, stats }: TaxVerdictProps) {
  return (
    <HeroShell innerClassName="grid gap-x-14 gap-y-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center p-6 sm:p-8">
      <div className="space-y-4 min-w-0">
        <Eyebrow>{totalLabel}</Eyebrow>
        <p
          id={valueId}
          className="text-5xl sm:text-6xl font-extrabold font-display tabular-nums leading-none tracking-[-0.03em] text-(--ink)"
        >
          {totalValue}
        </p>
        <div className="space-y-1.5">
          <p className="text-base font-medium leading-snug text-(--ink) [text-wrap:balance] max-w-[68ch]">
            {headline}
          </p>
          {detail && (
            <p className="text-sm text-(--muted) leading-relaxed max-w-[75ch]">{detail}</p>
          )}
        </div>
      </div>

      {stats.length > 0 && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4 gap-x-10 gap-y-6 border-t border-(--border) pt-5 xl:border-t-0 xl:pt-0 xl:border-l xl:pl-14">
          {stats.map((s) => (
            <div key={s.label} className="space-y-1.5">
              <dt className="text-xs font-medium text-(--muted)">{s.label}</dt>
              <dd className="text-2xl sm:text-3xl font-extrabold font-display tabular-nums leading-none tracking-[-0.02em] text-(--ink)">
                {s.value}
              </dd>
              {s.sub && <dd className="text-xs text-(--muted)">{s.sub}</dd>}
            </div>
          ))}
        </dl>
      )}
    </HeroShell>
  )
}
