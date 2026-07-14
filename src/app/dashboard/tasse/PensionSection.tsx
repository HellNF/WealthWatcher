// src/app/dashboard/tasse/PensionSection.tsx — Dettaglio avanzato IRPEF (scaglioni) + previdenza.
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Card, Stat, ProgressBar } from '@/components/ui'
import type { IncomeTaxEstimate } from '@/lib/tax/income'
import type { PensionTaxStatus } from '@/lib/tax/pension'
import { fmtEurDec, fmtPct } from './format'

interface Props {
  year:      string
  incomeTax: IncomeTaxEstimate
  pension:   PensionTaxStatus
}

export default function PensionSection({ year, incomeTax, pension }: Props) {
  const showIrpef   = incomeTax.applicable && incomeTax.totalMinor > 0
  const showPension = pension.marginalRate !== null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
      {/* ── IRPEF ── */}
      {showIrpef && (
        <Card className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <Stat label="Imponibile" value={fmtEurDec(incomeTax.taxableMinor)} size="sm" />
            {incomeTax.irpefMinor > 0 && <Stat label="IRPEF" value={fmtEurDec(incomeTax.irpefMinor)} size="sm" />}
            {incomeTax.substituteMinor > 0 && <Stat label="Imposta sost." value={fmtEurDec(incomeTax.substituteMinor)} size="sm" />}
            {incomeTax.addizionaliMinor > 0 && <Stat label="Addizionali" value={fmtEurDec(incomeTax.addizionaliMinor)} size="sm" />}
            <Stat
              label="Totale stimato"
              value={fmtEurDec(incomeTax.totalMinor)}
              sub={`Aliq. eff. ${fmtPct(incomeTax.effectiveRate)}`}
              size="sm"
            />
          </div>

          {incomeTax.brackets.length > 0 && (
            <div className="pt-3 border-t border-[--border] space-y-1">
              <p className="text-xs text-[--muted] mb-1">Scaglioni IRPEF applicati</p>
              {incomeTax.brackets.map((b, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-[--muted] font-mono tabular-nums">{fmtPct(b.rate)}</span>
                  <span className="text-[--faint]">su {fmtEurDec(b.taxedMinor)}</span>
                  <span className="text-[--ink] font-medium font-mono tabular-nums">{fmtEurDec(b.taxMinor)}</span>
                </div>
              ))}
            </div>
          )}

          {incomeTax.note && (
            <div className="flex items-start gap-2 rounded-lg bg-[--warning]/10 border border-[--warning]/30 px-3 py-2">
              <AlertTriangle className="size-3.5 text-[--warning] shrink-0 mt-0.5" />
              <p className="text-xs text-[--muted]">{incomeTax.note}</p>
            </div>
          )}
          <p className="text-xs text-[--faint]">
            Stima distinta dal carico su investimenti. Non include contributi INPS.{' '}
            <Link href="/dashboard/profilo" className="text-[--brand-text] hover:underline">Modifica profilo →</Link>
          </p>
        </Card>
      )}

      {/* ── Previdenza complementare ── */}
      {showPension && (
        <Card className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <Stat label={`Contributi versati ${year}`} value={fmtEurDec(pension.contributionsCurrentYearMinor)} size="sm" />
            <Stat
              label="Spazio deducibile residuo"
              value={fmtEurDec(pension.remainingDeductibleSpaceMinor)}
              sub={`max €${(pension.maxDeductionLimitMinor / 100).toLocaleString('it-IT')}`}
              size="sm"
            />
            <Stat
              label="Risparmio IRPEF realizzato"
              value={pension.currentTaxRefundRealizedMinor > 0 ? fmtEurDec(pension.currentTaxRefundRealizedMinor) : '—'}
              sub={`aliq. ${((pension.marginalRate ?? 0) * 100).toFixed(0)}%`}
              size="sm"
            />
            <Stat
              label="Risparmio potenziale rimasto"
              value={pension.potentialTaxRefundRemainingMinor > 0 ? fmtEurDec(pension.potentialTaxRefundRemainingMinor) : '—'}
              size="sm"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-[--muted]">
              <span>Utilizzo massimale deducibile</span>
              <span className="tabular-nums font-medium">{pension.progressBarPercentage}%</span>
            </div>
            <ProgressBar
              value={pension.contributionsCurrentYearMinor}
              max={pension.maxDeductionLimitMinor}
              color="var(--brand)"
            />
          </div>
        </Card>
      )}
    </div>
  )
}
