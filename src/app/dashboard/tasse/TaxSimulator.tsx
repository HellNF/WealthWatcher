'use client'

import { useState, useTransition } from 'react'
import { Calculator, Loader2, Info } from 'lucide-react'
import { simulateSaleAction } from './actions'
import type { TaxSimResult } from '@/lib/taxSim'
import { Field, Input, Select } from '@/components/ui'

interface InstrumentOption {
  instrumentId:  number
  symbol:        string
  name:          string
  remainingQty:  string
  lastPrice:     string | null
  currency:      string
}

interface Props {
  portfolioId: number
  instruments: InstrumentOption[]
}

function fmtCur(minor: number, currency: string): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency', currency, minimumFractionDigits: 2,
  })
}

function fmtPct(rate: number): string {
  return (rate * 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'
}

function sign(n: number) { return n >= 0 ? '+' : '' }

export default function TaxSimulator({ portfolioId, instruments }: Props) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<TaxSimResult | null>(null)

  const [instrId, setInstrId] = useState<number>(instruments[0]?.instrumentId ?? 0)
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState(() => instruments[0]?.lastPrice ?? '')

  const selected = instruments.find(i => i.instrumentId === instrId)

  function handleInstrChange(id: number) {
    setInstrId(id)
    setResult(null)
    const instr = instruments.find(i => i.instrumentId === id)
    if (instr?.lastPrice) setPrice(instr.lastPrice)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    const qtyNum   = parseFloat(qty.replace(',', '.'))
    const priceNum = parseFloat(price.replace(',', '.'))
    if (isNaN(qtyNum) || isNaN(priceNum) || qtyNum <= 0 || priceNum <= 0) return
    setResult(null)
    startTransition(async () => {
      const res = await simulateSaleAction(portfolioId, instrId, qtyNum, priceNum)
      setResult(res)
    })
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Strumento" htmlFor="tax-instr" className="flex-1">
            <Select
              id="tax-instr"
              value={instrId}
              onChange={e => handleInstrChange(Number(e.target.value))}
            >
              {instruments.map(i => (
                <option key={i.instrumentId} value={i.instrumentId}>
                  {i.symbol} — {i.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={`Quantità (max ${selected?.remainingQty ?? '—'})`}
            htmlFor="tax-qty"
            className="w-40"
          >
            <Input
              id="tax-qty"
              value={qty}
              onChange={e => { setQty(e.target.value); setResult(null) }}
              placeholder="es. 10"
            />
          </Field>
          <Field
            label={`Prezzo (${selected?.currency ?? 'EUR'})`}
            htmlFor="tax-price"
            className="w-36"
          >
            <Input
              id="tax-price"
              value={price}
              onChange={e => { setPrice(e.target.value); setResult(null) }}
              placeholder="es. 98.50"
            />
          </Field>
          <button
            type="submit"
            disabled={isPending || !qty || !price}
            className="shrink-0 inline-flex items-center gap-2 rounded-lg border border-[--border] bg-[--surface-1] px-4 py-2 text-sm font-medium text-[--ink] hover:bg-[--surface-2] disabled:opacity-50 transition-colors self-end"
          >
            {isPending
              ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
              : <Calculator className="size-4" strokeWidth={1.75} />}
            Simula
          </button>
        </div>
      </form>

      {result && (
        <div className="rounded-xl border border-[--border] overflow-hidden">
          {!result.hasData ? (
            <p className="px-4 py-3 text-sm text-[--danger]">{result.error}</p>
          ) : (
            <>
              {/* ── Riepilogo regime fiscale ────────────────────────────────── */}
              <div className="px-4 py-2.5 bg-[--surface-2] border-b border-[--border] flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-xs text-[--muted]">
                  Aliquota applicata:{' '}
                  <strong className="text-[--ink] tabular-nums">{fmtPct(result.appliedRate)}</strong>
                </span>
                <span className="text-xs text-[--muted]">
                  Tipo reddito:{' '}
                  <strong className="text-[--ink]">
                    {result.incomeType === 'capitale' ? 'Reddito di Capitale' : 'Reddito Diverso'}
                  </strong>
                </span>
                {result.incomeType === 'capitale' && (
                  <span className="inline-flex items-center gap-1 text-xs text-[--faint]">
                    <Info className="size-3" />
                    ETF in guadagno: non compensa lo zainetto fiscale
                  </span>
                )}
              </div>

              {/* ── Franchigia cripto ───────────────────────────────────────── */}
              {result.cluster === 'crypto' && result.totalGrossGainMinor > 0 && (
                <div className={`px-4 py-2.5 border-b border-[--border] text-xs ${result.cryptoExempt ? 'bg-[--brand-subtle] text-[--brand-text]' : 'text-[--muted]'}`}>
                  {result.cryptoExempt ? (
                    <>
                      <strong>Imposta: 0 € (sotto franchigia)</strong> — Plusvalenze cripto annue:{' '}
                      {fmtCur(result.cryptoAnnualGainMinor, result.currency)} su soglia di 2.000 € (Art. 67 c. 1 TUIR).
                    </>
                  ) : (
                    <>
                      Plusvalenze cripto annue: <strong>{fmtCur(result.cryptoAnnualGainMinor, result.currency)}</strong> — sopra franchigia 2.000 €, imposta dovuta.
                    </>
                  )}
                </div>
              )}

              {/* ── Compensazione zainetto ──────────────────────────────────── */}
              {result.compensatedMinor > 0 && (
                <div className="px-4 py-2.5 border-b border-[--border] text-xs text-[--brand-text] bg-[--brand-subtle]">
                  Minusvalenze compensate dallo zainetto fiscale:{' '}
                  <strong>{fmtCur(result.compensatedMinor, result.currency)}</strong>
                  {' '}— imponibile ridotto a{' '}
                  <strong>{fmtCur(result.taxableAfterCompensationMinor, result.currency)}</strong>
                </div>
              )}

              {/* ── Breakdown per lotto ─────────────────────────────────────── */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[--border] bg-[--surface-2]">
                      <th className="px-4 py-2 text-left text-xs font-medium text-[--muted]">Lotto</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-[--muted]">Quote</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-[--muted]">Costo/quota</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-[--muted]">Plusvalenza lorda</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-[--muted]">
                        Imposta {fmtPct(result.appliedRate)}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[--border]">
                    {result.lots.map((lot, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2.5 text-xs text-[--muted]">{lot.purchaseDate}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                          {lot.qtyConsumed.toLocaleString('it-IT', { maximumFractionDigits: 6 })}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-xs text-[--muted]">
                          {lot.costPerUnit.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </td>
                        <td className={`px-4 py-2.5 text-right tabular-nums text-xs font-medium ${lot.grossGainMinor >= 0 ? 'text-[--brand-text]' : 'text-[--danger]'}`}>
                          {sign(lot.grossGainMinor)}{fmtCur(lot.grossGainMinor, result.currency)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                          {lot.taxDueMinor > 0
                            ? <span className="text-[--danger]">−{fmtCur(lot.taxDueMinor, result.currency)}</span>
                            : lot.taxCreditMinor > 0
                              ? <span className="text-[--brand-text]">credito +{fmtCur(lot.taxCreditMinor, result.currency)}</span>
                              : <span className="text-[--faint]">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Totali ─────────────────────────────────────────────────── */}
              <div className="border-t border-[--border] bg-[--surface-2] px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-[--muted]">Plusvalenza lorda</p>
                  <p className={`text-base font-bold font-mono tabular-nums ${result.totalGrossGainMinor >= 0 ? 'text-[--brand-text]' : 'text-[--danger]'}`}>
                    {sign(result.totalGrossGainMinor)}{fmtCur(result.totalGrossGainMinor, result.currency)}
                  </p>
                </div>
                {result.totalTaxDueMinor > 0 && !result.cryptoExempt && (
                  <div>
                    <p className="text-xs text-[--muted]">Imposta ({fmtPct(result.appliedRate)})</p>
                    <p className="text-base font-bold font-mono tabular-nums text-[--danger]">
                      −{fmtCur(result.totalTaxDueMinor, result.currency)}
                    </p>
                  </div>
                )}
                {result.cryptoExempt && (
                  <div>
                    <p className="text-xs text-[--muted]">Imposta (cripto)</p>
                    <p className="text-base font-bold font-mono tabular-nums text-[--brand-text]">0 €</p>
                    <p className="text-xs text-[--faint] mt-0.5">sotto franchigia</p>
                  </div>
                )}
                {result.totalTaxCreditMinor > 0 && (
                  <div>
                    <p className="text-xs text-[--muted]">Credito zainetto fiscale</p>
                    <p className="text-base font-bold font-mono tabular-nums text-[--brand-text]">
                      +{fmtCur(result.totalTaxCreditMinor, result.currency)}
                    </p>
                    <p className="text-xs text-[--faint] mt-0.5">compensabile entro 4 anni</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-[--muted]">
                    {result.totalGrossGainMinor >= 0 ? 'Incasso netto' : 'Perdita netta'}
                  </p>
                  <p className={`text-base font-bold font-mono tabular-nums ${result.totalNetMinor >= 0 ? 'text-[--ink]' : 'text-[--danger]'}`}>
                    {sign(result.totalNetMinor)}{fmtCur(result.totalNetMinor, result.currency)}
                  </p>
                </div>
              </div>

              {/* ── Note legali ────────────────────────────────────────────── */}
              {result.totalGrossGainMinor < 0 && (
                <p className="px-4 py-2.5 text-xs text-[--muted] border-t border-[--border]">
                  Vendere in perdita genera un credito fiscale nello{' '}
                  <strong className="text-[--ink]">zainetto fiscale</strong>{' '}
                  di <strong className="text-[--ink]">{fmtCur(result.totalTaxCreditMinor, result.currency)}</strong>{' '}
                  utilizzabile per compensare future plusvalenze entro 4 anni (Art. 68 TUIR).
                </p>
              )}
              {result.incomeType === 'capitale' && (
                <p className="px-4 py-2.5 text-xs text-[--muted] border-t border-[--border]">
                  Le plusvalenze da ETF sono <strong className="text-[--ink]">redditi di capitale</strong> e
                  non possono essere compensate con lo zainetto fiscale (D.Lgs. 461/1997, Art. 68 TUIR).
                  Le minusvalenze da ETF sono invece <strong className="text-[--ink]">redditi diversi</strong> e generano credito compensabile.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
