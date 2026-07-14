// src/app/dashboard/mercati/SourceLink.tsx — Link alla fonte dati di un
// indicatore, stesso stile di tasse/SourceLink. Apre in nuova scheda; le fonti
// istituzionali (BCE) hanno un pallino di segnalazione.
import { ExternalLink } from 'lucide-react'
import { sourceFor } from './sources'

interface Props {
  /** Valore del campo `source` del MarketSignal (es. 'Yahoo Finance'). */
  source:     string
  estimated?: boolean
}

export default function SourceLink({ source, estimated }: Props) {
  const s = sourceFor(source)
  if (!s) return <span>Fonte: {source}{estimated ? ' · stima' : ''}</span>

  return (
    <a
      href={s.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-1.5 text-[--faint] hover:text-[--brand-text] transition-colors"
    >
      {s.official && (
        <span className="size-1.5 rounded-full bg-[--brand] shrink-0" title="Fonte istituzionale" aria-hidden />
      )}
      <span className="underline decoration-dotted underline-offset-2">Fonte: {s.label}</span>
      {estimated && <span>· stima</span>}
      <ExternalLink className="size-3 shrink-0 opacity-70 group-hover:opacity-100" strokeWidth={1.75} aria-hidden />
    </a>
  )
}
