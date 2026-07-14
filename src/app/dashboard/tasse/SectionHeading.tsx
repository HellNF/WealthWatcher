// src/app/dashboard/tasse/SectionHeading.tsx — Intestazione di sezione uniforme.
// Tile icona brand + titolo, con fonte contestuale a destra (allineata allo stile
// "ClusterHeader" di statistiche) ed eventuale slot azioni (es. BolloToggle).
import type { SourceTopic } from './sources'
import SourceLink from './SourceLink'

interface SectionHeadingProps {
  icon: React.ElementType
  title: string
  source?: SourceTopic
  actions?: React.ReactNode
}

export default function SectionHeading({ icon: Icon, title, source, actions }: SectionHeadingProps) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[--brand-subtle] text-[--brand-text]">
          <Icon className="size-4" strokeWidth={1.75} aria-hidden />
        </span>
        <h2 className="text-base font-semibold text-[--ink]">{title}</h2>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {actions}
        {source && <SourceLink topic={source} />}
      </div>
    </div>
  )
}
