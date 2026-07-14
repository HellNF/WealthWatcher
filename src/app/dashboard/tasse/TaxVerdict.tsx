// src/app/dashboard/tasse/TaxVerdict.tsx — Card "verdetto fiscale": la risposta in 5 secondi.
// Headline in linguaggio naturale + carico totale prominente + 4 metriche di contorno.
// Componente presentazionale: tutta la logica (headline, leva principale) è calcolata a monte.
import { Card } from '@/components/ui'
import { cn } from '@/lib/cn'

export interface VerdictStat {
  label: string
  value: string
  sub?:  string
  /** 'danger' per importi in uscita/imposte, altrimenti neutro. */
  tone?: 'danger' | 'ink'
}

interface TaxVerdictProps {
  headline:   string
  detail?:    string
  totalLabel: string
  totalValue: string
  stats:      VerdictStat[]
}

export default function TaxVerdict({ headline, detail, totalLabel, totalValue, stats }: TaxVerdictProps) {
  return (
    <Card noPadding className="relative overflow-hidden">
      {/* glow ambientale */}
      <div
        className="pointer-events-none absolute -top-28 -right-20 w-80 h-80 rounded-full bg-[--brand]/[0.07] blur-[90px]"
        aria-hidden
      />
      <div className="relative p-5 sm:p-6 space-y-5">
        <div className="space-y-2">
          <p className="text-lg font-semibold leading-snug text-[--ink] [text-wrap:balance] max-w-[68ch]">
            {headline}
          </p>
          {detail && (
            <p className="text-sm text-[--muted] leading-relaxed max-w-[75ch]">{detail}</p>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">{totalLabel}</p>
          <p className="mt-1 text-4xl sm:text-5xl font-bold font-mono tabular-nums tracking-tight text-[--danger]">
            {totalValue}
          </p>
        </div>

        {stats.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 pt-4 border-t border-[--border]">
            {stats.map((s) => (
              <div key={s.label} className="space-y-1">
                <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">{s.label}</p>
                <p className={cn(
                  'text-xl font-semibold font-mono tabular-nums leading-none',
                  s.tone === 'danger' ? 'text-[--danger]' : 'text-[--ink]',
                )}>
                  {s.value}
                </p>
                {s.sub && <p className="text-xs text-[--faint]">{s.sub}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
