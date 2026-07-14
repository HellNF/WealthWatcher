// src/app/dashboard/mercati/StanceMeter.tsx — Indicatore a 5 livelli della
// stance di settore. Scala divergente (teso ↔ favorevole) con il livello attivo
// evidenziato. Server Component puro (nessuna interattività).
import type { Stance } from '@/lib/marketOverview/analysis/types'
import { STANCE_ORDER, STANCE_META } from './meta'

export function StanceMeter({ stance, showLabel = true }: { stance: Stance; showLabel?: boolean }) {
  const active = STANCE_META[stance]
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1" role="img" aria-label={`Valutazione di contesto: ${active.label}`}>
        {STANCE_ORDER.map((s) => {
          const isActive = s === stance
          const meta = STANCE_META[s]
          return (
            <span
              key={s}
              className="h-2 flex-1 rounded-full transition-colors"
              style={{
                background: isActive ? meta.color : 'var(--surface-2)',
                outline: isActive ? `2px solid ${meta.color}` : 'none',
                outlineOffset: 2,
              }}
              title={meta.label}
            />
          )
        })}
      </div>
      {showLabel && (
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full shrink-0" style={{ background: active.color }} aria-hidden />
          <span className="text-xs font-semibold" style={{ color: active.color }}>{active.label}</span>
        </div>
      )}
    </div>
  )
}
