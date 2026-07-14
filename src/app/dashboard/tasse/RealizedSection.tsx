// src/app/dashboard/tasse/RealizedSection.tsx — Dettaglio avanzato plus/minusvalenze
// realizzate + zainetto fiscale. Le tabelle sono dentro <details> (drill-down accessibile).
import { AlertTriangle, ChevronDown } from 'lucide-react'
import { Card, Stat } from '@/components/ui'
import { fromMinor } from '@/lib/money'
import type { RealizedYearTax } from '@/lib/tax/annual'
import type { FiscalWallet } from '@/lib/tax/wallet'
import { fmtEur, fmtEurDec, sign } from './format'

interface Props {
  year:         string
  currentYear:  string
  realizedTax:  RealizedYearTax
  fiscalWallet: FiscalWallet
}

export default function RealizedSection({ year, currentYear, realizedTax, fiscalWallet }: Props) {
  const hasActivity = realizedTax.events.length > 0
  const hasWallet   = fiscalWallet.totalCreditMinor > 0 || fiscalWallet.expiredCreditMinor > 0

  return (
    <Card className="space-y-5">
      {/* ── Plus/minusvalenze realizzate ── */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[--faint]">
          Plus/minusvalenze realizzate {year}
        </p>
        {!hasActivity ? (
          <p className="text-sm text-[--muted]">Nessuna vendita registrata nel {year}.</p>
        ) : (
          <>
            {realizedTax.stale && (
              <div className="flex items-start gap-2 rounded-lg border border-[--warning]/40 bg-[--warning]/10 px-3 py-2 text-xs text-[--muted]">
                <AlertTriangle className="size-3.5 text-[--warning] shrink-0 mt-0.5" strokeWidth={1.75} />
                <span>Conversione valuta non disponibile per alcuni eventi — valori EUR approssimati.</span>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat label="Plusvalenze lorde" value={fmtEur(realizedTax.grossGainMinor)} size="sm" />
              <Stat label="Minusvalenze" value={realizedTax.lossMinor > 0 ? `−${fmtEur(realizedTax.lossMinor)}` : '—'} size="sm" />
              <Stat label="Compensazione zainetto" value={realizedTax.compensatedMinor > 0 ? `−${fmtEur(realizedTax.compensatedMinor)}` : '—'} size="sm" />
              <Stat label={`Imposta dovuta ${year}`} value={fmtEur(realizedTax.totalTaxDueMinor)} size="sm" />
            </div>

            <details className="group">
              <summary className="flex items-center gap-1.5 cursor-pointer list-none text-xs font-medium text-[--brand-text] w-fit">
                <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" strokeWidth={2} aria-hidden />
                Dettaglio per strumento ({realizedTax.events.length})
              </summary>
              <div className="mt-3 overflow-x-auto rounded-xl border border-[--border]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[--border] bg-[--surface-2]">
                      <th className="px-3 py-2 text-left font-medium text-[--muted]">Strumento</th>
                      <th className="px-3 py-2 text-right font-medium text-[--muted]">P/L EUR</th>
                      <th className="px-3 py-2 text-right font-medium text-[--muted]">Imposta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[--border]">
                    {realizedTax.events.map((ev, i) => (
                      <tr key={i} className="hover:bg-[--surface-2] transition-colors">
                        <td className="px-3 py-2 text-[--ink] max-w-[200px] truncate">{ev.instrumentName}</td>
                        <td className={`px-3 py-2 text-right font-mono tabular-nums font-medium ${ev.gainEurMinor >= 0 ? 'text-[--brand-text]' : 'text-[--danger]'}`}>
                          {sign(ev.gainEurMinor)}{fmtEurDec(ev.gainEurMinor)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums">
                          {ev.taxMinor > 0
                            ? <span className="text-[--danger]">−{fmtEurDec(ev.taxMinor)}</span>
                            : ev.gainEurMinor < 0
                              ? <span className="text-[--brand-text]">credito</span>
                              : <span className="text-[--faint]">esente</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </div>

      {/* ── Zainetto fiscale ── */}
      <div className="space-y-3 pt-5 border-t border-[--border]">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[--faint]">
          Zainetto fiscale — minusvalenze disponibili
        </p>
        {!hasWallet ? (
          <p className="text-sm text-[--muted]">Nessuna minusvalenza disponibile nello zainetto fiscale.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {fiscalWallet.totalCreditMinor > 0 && (
                <Stat label="Credito disponibile" value={fromMinor(fiscalWallet.totalCreditMinor, 'EUR')} size="sm" />
              )}
              {fiscalWallet.expiringThisYearMinor > 0 && (
                <Stat label="In scadenza entro 31/12" value={fromMinor(fiscalWallet.expiringThisYearMinor, 'EUR')} size="sm" />
              )}
              {fiscalWallet.expiredCreditMinor > 0 && (
                <Stat label="Crediti scaduti" value={fromMinor(fiscalWallet.expiredCreditMinor, 'EUR')} size="sm" />
              )}
            </div>
            {fiscalWallet.credits.length > 0 && (
              <details className="group">
                <summary className="flex items-center gap-1.5 cursor-pointer list-none text-xs font-medium text-[--brand-text] w-fit">
                  <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" strokeWidth={2} aria-hidden />
                  Crediti e scadenze ({fiscalWallet.credits.length})
                </summary>
                <div className="mt-3 overflow-x-auto rounded-xl border border-[--border]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[--border] bg-[--surface-2]">
                        <th className="px-3 py-2 text-left font-medium text-[--muted]">Realizzo</th>
                        <th className="px-3 py-2 text-left font-medium text-[--muted]">Scadenza</th>
                        <th className="px-3 py-2 text-right font-medium text-[--muted]">Credito</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[--border]">
                      {fiscalWallet.credits.map((c, i) => {
                        const isExpiring = c.expiryDate.startsWith(currentYear)
                        return (
                          <tr key={i} className="hover:bg-[--surface-2] transition-colors">
                            <td className="px-3 py-2 text-[--muted]">{c.realizedDate}</td>
                            <td className={`px-3 py-2 ${isExpiring ? 'text-[--warning-text] font-medium' : 'text-[--muted]'}`}>
                              {c.expiryDate}
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-[--brand-text] font-medium">
                              {fromMinor(c.amountMinor, 'EUR')}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </Card>
  )
}
