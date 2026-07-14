// src/app/dashboard/tasse/SourceLink.tsx — Link fonte contestuale accanto a una sezione.
// Apre in nuova scheda; le fonti istituzionali hanno un pallino di segnalazione.
import { ExternalLink } from 'lucide-react'
import type { SourceTopic, TaxSource } from './sources'
import { TAX_SOURCES } from './sources'

interface SourceLinkProps {
  /** Chiave tematica oppure una fonte esplicita. */
  topic?: SourceTopic
  source?: TaxSource
}

export default function SourceLink({ topic, source }: SourceLinkProps) {
  const s = source ?? (topic ? TAX_SOURCES[topic] : undefined)
  if (!s) return null
  return (
    <a
      href={s.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-1.5 text-xs text-[--faint] hover:text-[--brand-text] transition-colors"
    >
      {s.official && (
        <span
          className="size-1.5 rounded-full bg-[--brand] shrink-0"
          title="Fonte istituzionale"
          aria-hidden
        />
      )}
      <span className="underline decoration-dotted underline-offset-2">Fonte: {s.label}</span>
      <ExternalLink className="size-3 shrink-0 opacity-70 group-hover:opacity-100" strokeWidth={1.75} aria-hidden />
    </a>
  )
}
