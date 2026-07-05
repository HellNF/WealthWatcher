import { requireUser } from '@/lib/dal'
import { realizedTaxForYear, taxYears } from '@/lib/tax/annual'
import { computeFiscalWallet } from '@/lib/tax/wallet'
import { latentTaxStats } from '@/lib/tax/latent'
import { estimatedWealthTaxes } from '@/lib/tax/wealth'
import { generateHarvestingRecommendations } from '@/lib/tax/harvesting'
import { totalInterestWithholding } from '@/lib/accounts'
import { listPortfolios } from '@/lib/portfolios'
import { getPortfolioPositions } from '@/lib/positions'
import { getUserProfile } from '@/lib/userSettings'
import { estimateIncomeTax } from '@/lib/tax/income'
import { getPensionTaxStatus } from '@/lib/tax/pension'
import { fromMinor } from '@/lib/money'
import {
  Landmark, TrendingDown, Briefcase, PiggyBank,
  Receipt, Calculator, AlertTriangle, User, Lightbulb, ShieldCheck, Info,
} from 'lucide-react'
import { Breadcrumb, Card, Stat, Badge, ProgressBar } from '@/components/ui'
import YearSelector from './YearSelector'
import SaleSimulatorSection from './SaleSimulatorSection'
import BolloToggle from './BolloToggle'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  })
}

function fmtEurDec(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2,
  })
}

function fmtBollo(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function fmtPct(rate: number): string {
  return (rate * 100).toLocaleString('it-IT', {
    minimumFractionDigits: 1, maximumFractionDigits: 2,
  }) + '%'
}

function sign(n: number): string { return n >= 0 ? '+' : '' }

function SectionHeader({
  icon: Icon, title, note,
}: {
  icon: React.ElementType
  title: string
  note?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-[--brand-text]" strokeWidth={1.75} />
      <h2 className="text-base font-semibold text-[--ink]">{title}</h2>
      {note && (
        <span title={note} className="cursor-help shrink-0">
          <Info className="size-3.5 text-[--faint] hover:text-[--muted] transition-colors" strokeWidth={1.75} />
        </span>
      )}
    </div>
  )
}

interface Props {
  searchParams: Promise<{ year?: string; quarterly?: string }>
}

export default async function TassePage({ searchParams }: Props) {
  const user        = await requireUser()
  const params      = await searchParams
  const today       = new Date()
  const currentYear = today.getFullYear().toString()
  const year        = params.year ?? currentYear
  const isQuarterly = params.quarterly === '1'
  const years       = taxYears(user.id)

  const [realizedTax, latentTax, wealthTaxes, harvestingRecs] = await Promise.all([
    realizedTaxForYear(user.id, year),
    latentTaxStats(user.id).catch(() => null),
    estimatedWealthTaxes(user.id, year).catch(() => null),
    generateHarvestingRecommendations(user.id).catch(() => []),
  ])

  const fiscalWallet  = computeFiscalWallet(user.id)
  const interestTotal = totalInterestWithholding(user.id)
  const profile       = getUserProfile(user.id)
  const incomeTax     = estimateIncomeTax(profile)
  const pensionStatus = getPensionTaxStatus(user.id, year)

  const portfolios = listPortfolios(user.id)
  const portfoliosForSimulator = portfolios
    .map(pf => {
      const { positions } = getPortfolioPositions(user.id, pf.id)
      const instruments = positions
        .filter(p => parseFloat(p.remainingQty) > 0)
        .map(p => ({
          instrumentId: p.instrumentId,
          symbol:       p.symbol,
          name:         p.name,
          remainingQty: p.remainingQty,
          lastPrice:    p.lastPrice,
          currency:     p.currency,
        }))
      return { portfolioId: pf.id, portfolioName: pf.name, instruments }
    })
    .filter(pf => pf.instruments.length > 0)

  const totalTaxMinor = realizedTax.totalTaxDueMinor
    + (wealthTaxes?.totalMinor ?? 0)
    + interestTotal.withholdingMinor

  const hasRealizedActivity = realizedTax.events.length > 0

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-10">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Tasse' },
      ]} />

      {/* Titolo + selettore anno */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Landmark className="size-5 text-[--brand-text]" strokeWidth={1.75} />
          <h1 className="text-xl font-bold text-[--ink]">Gestione tasse — {year}</h1>
        </div>
        <YearSelector years={years} selectedYear={year} />
      </div>

      {/* ══ RIGA 1: Riepilogo (sx) + Tasse Latenti (dx) ═══════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

        {/* ── Riepilogo carico fiscale ── */}
        <section className="space-y-4">
          <SectionHeader icon={Receipt} title={`Riepilogo carico fiscale ${year}`} />
          <Card className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">Totale stimato {year}</p>
                <p className="text-3xl font-bold font-mono tabular-nums text-[--danger] mt-1">
                  {fmtEur(totalTaxMinor)}
                </p>
              </div>
              <Badge variant="warning">stima</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Stat
                label="Imposta su plus realizzate"
                value={fmtEur(realizedTax.totalTaxDueMinor - realizedTax.dividendTaxMinor)}
                size="sm"
                sub={realizedTax.compensatedMinor > 0
                  ? `dopo ${fmtEur(realizedTax.compensatedMinor)} compensazione`
                  : undefined}
              />
              <Stat
                label="Ritenuta dividendi (26%)"
                value={realizedTax.dividendTaxMinor > 0 ? fmtEur(realizedTax.dividendTaxMinor) : '—'}
                size="sm"
              />
              <Stat
                label="Bollo/IVAFE"
                value={wealthTaxes ? fmtBollo(wealthTaxes.totalMinor) : '—'}
                size="sm"
                sub={wealthTaxes?.stale ? 'cambio BCE parziale' : undefined}
              />
              <Stat
                label="Ritenuta interessi"
                value={interestTotal.accountCount > 0 ? fmtEur(interestTotal.withholdingMinor) : '—'}
                size="sm"
              />
            </div>

            <p className="text-xs text-[--faint]">
              Stima informativa. Non costituisce consulenza fiscale. Rivolgiti a un commercialista per la dichiarazione dei redditi.
            </p>
          </Card>
        </section>

        {/* ── Tasse latenti sugli investimenti ── */}
        <section className="space-y-4">
          <SectionHeader
            icon={TrendingDown}
            title="Tasse latenti sugli investimenti"
            note="Stima teorica se vendessi oggi tutte le posizioni in guadagno. Aliquota specifica per strumento (12,5%–26%). Non considera la compensazione con lo zainetto fiscale."
          />
          {!latentTax || latentTax.latentTaxMinor === 0 ? (
            <Card>
              <p className="text-sm text-[--muted]">
                Nessuna tassa latente stimata (nessuna plusvalenza non realizzata nelle posizioni aperte).
              </p>
            </Card>
          ) : (
            <Card className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <Stat label="Investimenti lordi"       value={fmtEur(latentTax.grossInvestmentMinor)} size="sm" />
                <Stat label="Tasse latenti stimate"    value={`−${fmtEur(latentTax.latentTaxMinor)}`}  size="sm" />
                <Stat label="Valore netto reale"       value={fmtEur(latentTax.netInvestmentMinor)}    size="sm" />
              </div>
              <div className="h-px bg-[--border]" />
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[--muted]">Impatto fiscale latente</p>
                  <div className="mt-2 h-2 rounded-full bg-[--surface-2] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[--danger]"
                      style={{ width: `${Math.min(100, (latentTax.latentTaxMinor / latentTax.grossInvestmentMinor) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-[--faint] mt-1">
                    {((latentTax.latentTaxMinor / latentTax.grossInvestmentMinor) * 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% del lordo
                  </p>
                </div>
              </div>
            </Card>
          )}
        </section>
      </div>

      {/* ══ RIGA 2: Plus/Minus + Zainetto (sx) | Tax-Loss Harvesting (dx) ══════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

        {/* ── Plus/Minusvalenze + Zainetto fiscale (card combinata) ── */}
        <section className="space-y-4">
          <SectionHeader icon={Briefcase} title={`Plus/minus e zainetto ${year}`} />
          <Card noPadding className="overflow-hidden divide-y divide-[--border]">

            {/* Plus/Minusvalenze */}
            <div className="px-4 py-4 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[--faint]">
                Plus/minusvalenze realizzate
              </p>
              {!hasRealizedActivity ? (
                <p className="text-sm text-[--muted]">Nessuna vendita registrata nel {year}.</p>
              ) : (
                <>
                  {realizedTax.stale && (
                    <div className="flex items-start gap-2 rounded-lg border border-[--warning] bg-[--surface-2] px-3 py-2 text-xs text-[--muted]">
                      <AlertTriangle className="size-3.5 text-[--warning] shrink-0 mt-0.5" strokeWidth={1.75} />
                      <span>Conversione valuta non disponibile per alcuni eventi — valori EUR approssimati.</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="Plusvalenze lorde"      value={fmtEur(realizedTax.grossGainMinor)} size="sm" />
                    <Stat label="Minusvalenze"           value={realizedTax.lossMinor > 0 ? `−${fmtEur(realizedTax.lossMinor)}` : '—'} size="sm" />
                    <Stat label="Compensazione zainetto" value={realizedTax.compensatedMinor > 0 ? `−${fmtEur(realizedTax.compensatedMinor)}` : '—'} size="sm" />
                    <Stat label={`Imposta dovuta ${year}`} value={fmtEur(realizedTax.totalTaxDueMinor)} size="sm" />
                  </div>

                  {realizedTax.cryptoGainMinor > 0 && (
                    <p className={`text-xs px-2 py-1 rounded-lg ${realizedTax.cryptoExempt ? 'bg-[--brand-subtle] text-[--brand-text]' : 'bg-[--surface-2] text-[--muted]'}`}>
                      Cripto {fmtEur(realizedTax.cryptoGainMinor)} —{' '}
                      {realizedTax.cryptoExempt ? 'sotto franchigia €2.000, esenti.' : 'sopra franchigia €2.000, tassati.'}
                    </p>
                  )}

                  <div className="overflow-x-auto -mx-4 px-4">
                    <table className="w-full text-xs min-w-[300px]">
                      <thead>
                        <tr className="border-b border-[--border]">
                          <th className="pb-1.5 text-left font-medium text-[--muted]">Strumento</th>
                          <th className="pb-1.5 text-right font-medium text-[--muted]">P/L EUR</th>
                          <th className="pb-1.5 text-right font-medium text-[--muted]">Imposta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[--border]">
                        {realizedTax.events.map((ev, i) => (
                          <tr key={i}>
                            <td className="py-1.5 text-[--ink] max-w-[160px] truncate">{ev.instrumentName}</td>
                            <td className={`py-1.5 text-right font-mono tabular-nums font-medium ${ev.gainEurMinor >= 0 ? 'text-[--brand-text]' : 'text-[--danger]'}`}>
                              {sign(ev.gainEurMinor)}{fmtEurDec(ev.gainEurMinor)}
                            </td>
                            <td className="py-1.5 text-right font-mono tabular-nums">
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
                </>
              )}
            </div>

            {/* Zainetto fiscale */}
            <div className="px-4 py-4 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[--faint]">
                Zainetto fiscale — minusvalenze disponibili
              </p>
              {fiscalWallet.totalCreditMinor === 0 && fiscalWallet.expiredCreditMinor === 0 ? (
                <p className="text-sm text-[--muted]">Nessuna minusvalenza disponibile nello zainetto fiscale.</p>
              ) : (
                <>
                  {fiscalWallet.expiringThisYearMinor > 0 && (
                    <div className="flex items-start gap-2 rounded-lg border border-[--warning] bg-[--surface-2] px-3 py-2 text-xs text-[--muted]">
                      <AlertTriangle className="size-3.5 text-[--warning] shrink-0 mt-0.5" strokeWidth={1.75} />
                      <span>
                        {fromMinor(fiscalWallet.expiringThisYearMinor, 'EUR')} in scadenza il 31/12 — realizza perdite per rinnovare il credito.
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
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
                    <div className="overflow-x-auto -mx-4 px-4">
                      <table className="w-full text-xs min-w-[260px]">
                        <thead>
                          <tr className="border-b border-[--border]">
                            <th className="pb-1.5 text-left font-medium text-[--muted]">Realizzo</th>
                            <th className="pb-1.5 text-left font-medium text-[--muted]">Scadenza</th>
                            <th className="pb-1.5 text-right font-medium text-[--muted]">Credito</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[--border]">
                          {fiscalWallet.credits.map((c, i) => {
                            const isExpiring = c.expiryDate.startsWith(currentYear)
                            return (
                              <tr key={i}>
                                <td className="py-1.5 text-[--muted]">{c.realizedDate}</td>
                                <td className={`py-1.5 ${isExpiring ? 'text-[--warning] font-medium' : 'text-[--muted]'}`}>
                                  {c.expiryDate}{isExpiring && ' ⚠️'}
                                </td>
                                <td className="py-1.5 text-right font-mono tabular-nums text-[--brand-text] font-medium">
                                  {fromMinor(c.amountMinor, 'EUR')}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Nota legale compatta */}
            <div className="px-4 py-2 bg-[--surface-2]">
              <p className="text-[10px] text-[--faint]">
                FIFO · Compensazione Art. 68 TUIR · D.Lgs. 461/1997 · Minusvalenze compensabili entro 4 anni.
              </p>
            </div>
          </Card>
        </section>

        {/* ── Tax-Loss Harvesting ── */}
        {harvestingRecs.length > 0 && (
          <section className="space-y-4">
            <SectionHeader icon={Lightbulb} title="Tax-Loss Harvesting" />
            <div className="space-y-3">
              {harvestingRecs.map((rec, i) => {
                const isExpiry  = rec.type === 'EXTEND_EXPIRY'
                const borderCls = isExpiry
                  ? 'border-[--warning] bg-[--surface-2]'
                  : 'border-[--border] bg-[--surface-2]'
                return (
                  <Card key={i} className={`space-y-3 ${borderCls}`}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={isExpiry ? 'warning' : 'info'}>
                          {isExpiry ? '⚠️ Credito in scadenza' : '💡 Genera credito'}
                        </Badge>
                        <span className="text-sm font-semibold text-[--ink]">{rec.assetName}</span>
                        <span className="text-xs font-mono text-[--muted]">{rec.ticker}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-[--muted]">{isExpiry ? 'Risparmio' : 'Credito futuro'}</p>
                        <p className={`text-base font-bold font-mono tabular-nums ${isExpiry ? 'text-[--warning]' : 'text-[--brand-text]'}`}>
                          {fmtEur(rec.taxImpactMinor)}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-[--muted] leading-relaxed">{rec.actionText}</p>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-[--faint]">Portafoglio</p>
                        <p className="text-xs font-medium text-[--ink] mt-0.5">{rec.portfolioName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-[--faint]">Qt. suggerita / totale</p>
                        <p className="text-xs font-mono font-medium text-[--ink] mt-0.5">{rec.suggestedQty} / {rec.remainingQty}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-[--faint]">
                          {rec.latentPlEurMinor >= 0 ? 'Plus latente' : 'Minus latente'}
                        </p>
                        <p className={`text-xs font-mono font-medium mt-0.5 ${rec.latentPlEurMinor >= 0 ? 'text-[--brand-text]' : 'text-[--danger]'}`}>
                          {rec.latentPlEurMinor >= 0 ? '+' : '−'}{fmtEur(rec.latentPlEurMinor)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-[--faint]">Aliquota</p>
                        <p className="text-xs font-mono font-medium text-[--ink] mt-0.5">{fmtPct(rec.appliedRate)}</p>
                      </div>
                    </div>
                  </Card>
                )
              })}
              <p className="text-xs text-[--faint]">
                Suggerimenti automatici basati su zainetto e posizioni aperte. La vendita e riacquisto immediato è legale in Italia (no wash-sale rule).
                Verifica le commissioni del tuo broker. Non costituisce consulenza fiscale.
              </p>
            </div>
          </section>
        )}
      </div>

      {/* ══ Imposte patrimoniali (full width, tabella migliorata) ══════════════ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <SectionHeader
            icon={Landmark}
            title={`Imposte patrimoniali ${year}`}
            note="Bollo conti IT: €34,20/anno fissi se giacenza media > €5.000 (Art. 13 c. 2-bis DPR 642/1972). Bollo/IVAFE titoli: 0,2% del controvalore al 31/12. IVAFE intermediari esteri: Art. 19 c. 18 DL 201/2011."
          />
          <BolloToggle />
        </div>

        {profile.taxResidency && profile.taxResidency.toUpperCase() !== 'IT' && (
          <div className="flex items-start gap-2 rounded-xl border border-[--warning]/40 bg-[--warning]/10 px-4 py-3">
            <AlertTriangle className="size-4 text-[--warning] shrink-0 mt-0.5" />
            <p className="text-xs text-[--muted]">
              Residenza fiscale <strong>{profile.taxResidency.toUpperCase()}</strong>: bollo e IVAFE italiani potrebbero non applicarsi. Valori calcolati come se fossi residente in Italia.{' '}
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
              <div className="flex items-center gap-2 text-xs text-[--warning]">
                <AlertTriangle className="size-3.5 shrink-0" strokeWidth={1.75} />
                Cambio BCE non disponibile per alcuni valori — stima parziale.
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
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

            {wealthTaxes.lines.filter(l => l.taxEurMinor > 0).length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-[--border]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[--border] bg-[--surface-2]">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-[--muted]">Strumento</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-[--muted]">Base imponibile</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-[--muted]">
                        Imposta {isQuarterly ? '(trim.)' : '(annua)'}
                      </th>
                      <th className="px-4 py-2.5 text-center text-xs font-medium text-[--muted]">Regime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[--border]">
                    {wealthTaxes.lines.filter(l => l.taxEurMinor > 0).map((line) => (
                      <tr key={`${line.kind}-${line.id}`} className="hover:bg-[--surface-2] transition-colors duration-100">
                        <td className="px-4 py-2.5 text-sm text-[--ink] font-medium max-w-[240px] truncate">{line.name}</td>
                        <td className="px-4 py-2.5 text-right text-xs font-mono tabular-nums text-[--muted]">
                          {line.kind === 'account'
                            ? `${fmtEur(line.baseEurMinor)} (media)`
                            : fmtEur(line.baseEurMinor)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs font-mono tabular-nums text-[--ink] font-medium">
                          {fmtBollo(isQuarterly ? line.taxEurMinor / 4 : line.taxEurMinor)}
                          {line.stale && <span className="text-[--warning] ml-1">*</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge variant={line.regime === 'ivafe' ? 'info' : 'neutral'}>
                            {line.regime}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {isQuarterly && (
              <p className="text-xs text-[--faint]">
                La vista trimestrale divide il totale annuo per 4 — la frequenza reale dipende dall&apos;intermediario.
              </p>
            )}
          </Card>
        )}
      </section>

      {/* ══ Ritenuta sugli interessi (full width) ══════════════════════════════ */}
      <section className="space-y-4">
        <SectionHeader
          icon={PiggyBank}
          title="Ritenuta sugli interessi"
          note="Ritenuta a titolo d'imposta del 26% sugli interessi da deposito (Art. 26 DPR 600/1973). Stima basata sulla giacenza corrente e sul tasso impostato — non sulla giacenza media dell'anno."
        />

        {interestTotal.accountCount === 0 ? (
          <Card>
            <p className="text-sm text-[--muted]">
              Nessun conto con tasso di interesse impostato.{' '}
              Imposta il tasso dalla pagina del conto per vedere la stima della ritenuta.
            </p>
          </Card>
        ) : (
          <Card className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              <Stat
                label="Interesse lordo / anno"
                value={fmtEur(interestTotal.grossAnnualMinor)}
                sub={`su ${interestTotal.accountCount} ${interestTotal.accountCount === 1 ? 'conto' : 'conti'}`}
                size="sm"
              />
              <Stat
                label="Ritenuta 26%"
                value={`−${fmtEur(interestTotal.withholdingMinor)}`}
                size="sm"
              />
              <Stat
                label="Netto / anno"
                value={fmtEur(interestTotal.netAnnualMinor)}
                sub={`≈ ${fmtEur(Math.round(interestTotal.netAnnualMinor / 12))}/mese`}
                size="sm"
              />
            </div>
          </Card>
        )}
      </section>

      {/* ══ IRPEF — visibile solo se i dati sono calcolabili ══════════════════ */}
      {incomeTax.applicable && incomeTax.totalMinor > 0 && (
        <section className="space-y-4">
          <SectionHeader icon={User} title="Imposte sul reddito (IRPEF) — stima" />
          <Card className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              <Stat label="Imponibile"      value={fmtEurDec(incomeTax.taxableMinor)} size="sm" />
              {incomeTax.irpefMinor > 0 && (
                <Stat label="IRPEF"         value={fmtEurDec(incomeTax.irpefMinor)}  size="sm" />
              )}
              {incomeTax.substituteMinor > 0 && (
                <Stat label="Imposta sost." value={fmtEurDec(incomeTax.substituteMinor)} size="sm" />
              )}
              {incomeTax.addizionaliMinor > 0 && (
                <Stat label="Addizionali"   value={fmtEurDec(incomeTax.addizionaliMinor)} size="sm" />
              )}
              <Stat
                label="Totale stimato"
                value={fmtEurDec(incomeTax.totalMinor)}
                size="sm"
                sub={`Aliq. eff. ${fmtPct(incomeTax.effectiveRate)}`}
              />
            </div>

            {incomeTax.brackets.length > 0 && (
              <div className="pt-3 border-t border-[--border]">
                <p className="text-xs text-[--muted] mb-2">Scaglioni IRPEF applicati</p>
                <div className="space-y-1">
                  {incomeTax.brackets.map((b, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-[--muted]">{fmtPct(b.rate)}</span>
                      <span className="text-[--faint]">su {fmtEurDec(b.taxedMinor)}</span>
                      <span className="text-[--ink] font-medium tabular-nums">{fmtEurDec(b.taxMinor)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {incomeTax.note && (
              <div className="flex items-start gap-2 rounded-lg bg-[--warning]/10 border border-[--warning]/30 px-3 py-2">
                <AlertTriangle className="size-3.5 text-[--warning] shrink-0 mt-0.5" />
                <p className="text-xs text-[--muted]">{incomeTax.note}</p>
              </div>
            )}

            <p className="text-xs text-[--faint]">
              Stima indicativa distinta dal carico su investimenti. Non include contributi INPS.{' '}
              <Link href="/dashboard/profilo" className="text-[--brand-text] hover:underline">Modifica profilo →</Link>
            </p>
          </Card>
        </section>
      )}

      {/* ══ Previdenza complementare — visibile solo se aliquota configurata ══ */}
      {pensionStatus.marginalRate !== null && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <SectionHeader icon={ShieldCheck} title={`Previdenza complementare ${year}`} />
            <Link href="/dashboard/settings" className="text-xs text-[--brand-text] hover:underline">
              Imposta aliquota IRPEF →
            </Link>
          </div>

          <Card className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              <Stat
                label={`Contributi versati ${year}`}
                value={fmtEurDec(pensionStatus.contributionsCurrentYearMinor)}
                size="sm"
              />
              <Stat
                label="Spazio deducibile residuo"
                value={fmtEurDec(pensionStatus.remainingDeductibleSpaceMinor)}
                sub={`max €${(pensionStatus.maxDeductionLimitMinor / 100).toLocaleString('it-IT')}`}
                size="sm"
              />
              <Stat
                label="Risparmio IRPEF realizzato"
                value={pensionStatus.currentTaxRefundRealizedMinor > 0
                  ? fmtEurDec(pensionStatus.currentTaxRefundRealizedMinor)
                  : '—'}
                sub={`aliq. ${((pensionStatus.marginalRate ?? 0) * 100).toFixed(0)}%`}
                size="sm"
              />
              <Stat
                label="Risparmio potenziale rimasto"
                value={pensionStatus.potentialTaxRefundRemainingMinor > 0
                  ? fmtEurDec(pensionStatus.potentialTaxRefundRemainingMinor)
                  : '—'}
                size="sm"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[--muted]">
                <span>Utilizzo massimale deducibile</span>
                <span className="tabular-nums font-medium">{pensionStatus.progressBarPercentage}%</span>
              </div>
              <ProgressBar
                value={pensionStatus.contributionsCurrentYearMinor}
                max={pensionStatus.maxDeductionLimitMinor}
                color="var(--brand)"
              />
              <p className="text-xs text-[--faint]">
                Massimale: €5.164,57 (Art. 10, c. 1, lett. e-ter TUIR). Transazioni categorizzate come &quot;Previdenza&quot; nell&apos;anno {year}.
              </p>
            </div>

            {pensionStatus.remainingDeductibleSpaceMinor > 0 && (
              <div className="rounded-lg border border-[--brand-subtle] bg-[--brand-subtle] px-4 py-3">
                <p className="text-sm text-[--brand-text]">
                  Versando altri {fmtEurDec(pensionStatus.remainingDeductibleSpaceMinor)} entro il 31/12/{year}
                  potresti ottenere un ulteriore risparmio IRPEF di{' '}
                  <strong>{fmtEurDec(pensionStatus.potentialTaxRefundRemainingMinor)}</strong>.
                </p>
              </div>
            )}
          </Card>
        </section>
      )}

      {/* ══ Simulatore vendita (full width, fondo pagina) ══════════════════════ */}
      <section className="space-y-4">
        <SectionHeader icon={Calculator} title="Simulatore vendita — Impatto fiscale" />
        <p className="text-xs text-[--muted]">
          Calcola plusvalenza lorda, imposta sostitutiva e guadagno netto di una vendita ipotetica
          secondo il metodo FIFO. Nessuna operazione viene registrata.
        </p>

        {portfoliosForSimulator.length === 0 ? (
          <Card>
            <p className="text-sm text-[--muted]">
              Nessuna posizione aperta disponibile per la simulazione.{' '}
              <Link href="/dashboard" className="text-[--brand-text] hover:underline">
                Vai alla dashboard
              </Link>{' '}
              per aggiungere operazioni.
            </p>
          </Card>
        ) : (
          <Card>
            <SaleSimulatorSection portfolios={portfoliosForSimulator} />
          </Card>
        )}
      </section>
    </main>
  )
}
