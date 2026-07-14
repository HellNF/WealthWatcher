// src/app/dashboard/tasse/WealthTaxSection.tsx — Imposte patrimoniali (bollo IT / IVAFE estero).
// Corpo della sezione avanzata; l'header (con BolloToggle) è renderizzato dalla pagina.
import Link from 'next/link'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import { Card, Stat, Badge } from '@/components/ui'
import type { WealthTaxStats } from '@/lib/tax/wealth'
import { fmtEur, fmtBollo } from './format'

interface Props {
  year:         string
  isQuarterly:  boolean
  wealthTaxes:  WealthTaxStats | null
  taxResidency: string | null
}

export default function WealthTaxSection({ year, isQuarterly, wealthTaxes, taxResidency }: Props) {
  const foreignResidency = taxResidency && taxResidency.toUpperCase() !== 'IT'
  const lines = wealthTaxes?.lines.filter(l => l.taxEurMinor > 0) ?? []

  return (
    <div className="space-y-4">
      {foreignResidency && (
        <div className="flex items-start gap-2 rounded-xl border border-[--warning]/40 bg-[--warning]/10 px-4 py-3">
          <AlertTriangle className="size-4 text-[--warning] shrink-0 mt-0.5" />
          <p className="text-xs text-[--muted]">
            Residenza fiscale <strong>{taxResidency!.toUpperCase()}</strong>: bollo e IVAFE italiani potrebbero non applicarsi. Valori calcolati come se fossi residente in Italia.{' '}
            <Link href="/dashboard/profilo" className="text-[--brand-text] hover:underline">Modifica profilo →</Link>
          </p>
        </div>
      )}

      {!wealthTaxes || wealthTaxes.totalMinor === 0 ? (
        <Card>
          <p className="text-sm text-[--muted]">
            Nessuna imposta patrimoniale stimata per il {year}
            {!wealthTaxes ? ' (calcolo non disponibile)' : ' (giacenza media ≤ €5.000 su tutti i conti, nessun titolo)'}.
          </p>
        </Card>
      ) : (
        <Card className="space-y-5">
          {wealthTaxes.stale && (
            <div className="flex items-center gap-2 text-xs text-[--warning-text]">
              <AlertTriangle className="size-3.5 shrink-0" strokeWidth={1.75} />
              Cambio BCE non disponibile per alcuni valori — stima parziale.
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
            <Stat
              label={isQuarterly ? 'Per trimestre (×4/anno)' : 'Totale stimato annuo'}
              value={fmtBollo(isQuarterly ? wealthTaxes.totalMinor / 4 : wealthTaxes.totalMinor)}
              sub="bollo + IVAFE"
              size="sm"
            />
            {wealthTaxes.totalBolloMinor > 0 && (
              <Stat
                label="Imposta di bollo (IT)"
                value={fmtBollo(isQuarterly ? wealthTaxes.totalBolloMinor / 4 : wealthTaxes.totalBolloMinor)}
                sub={isQuarterly ? 'per trimestre' : 'conti e titoli italiani'}
                size="sm"
              />
            )}
            {wealthTaxes.totalIvafeMinor > 0 && (
              <Stat
                label="IVAFE (estero)"
                value={fmtBollo(isQuarterly ? wealthTaxes.totalIvafeMinor / 4 : wealthTaxes.totalIvafeMinor)}
                sub={isQuarterly ? 'per trimestre' : 'conti e titoli esteri'}
                size="sm"
              />
            )}
          </div>

          {lines.length > 0 && (
            <details className="group">
              <summary className="flex items-center gap-1.5 cursor-pointer list-none text-xs font-medium text-[--brand-text] w-fit">
                <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" strokeWidth={2} aria-hidden />
                Dettaglio per strumento ({lines.length})
              </summary>
              <div className="mt-3 overflow-x-auto rounded-xl border border-[--border]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[--border] bg-[--surface-2]">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[--muted]">Strumento</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-[--muted]">Base imponibile</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-[--muted]">Imposta {isQuarterly ? '(trim.)' : '(annua)'}</th>
                      <th className="px-4 py-2.5 text-center text-xs font-medium text-[--muted]">Regime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[--border]">
                    {lines.map((line) => (
                      <tr key={`${line.kind}-${line.id}`} className="hover:bg-[--surface-2] transition-colors">
                        <td className="px-4 py-2.5 text-sm text-[--ink] font-medium max-w-[240px] truncate">{line.name}</td>
                        <td className="px-4 py-2.5 text-right text-xs font-mono tabular-nums text-[--muted]">
                          {line.kind === 'account' ? `${fmtEur(line.baseEurMinor)} (media)` : fmtEur(line.baseEurMinor)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs font-mono tabular-nums text-[--ink] font-medium">
                          {fmtBollo(isQuarterly ? line.taxEurMinor / 4 : line.taxEurMinor)}
                          {line.stale && <span className="text-[--warning-text] ml-1">*</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge variant={line.regime === 'ivafe' ? 'info' : 'neutral'}>{line.regime}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {isQuarterly && (
            <p className="text-xs text-[--faint]">
              La vista trimestrale divide il totale annuo per 4 — la frequenza reale dipende dall&apos;intermediario.
            </p>
          )}
        </Card>
      )}
    </div>
  )
}
