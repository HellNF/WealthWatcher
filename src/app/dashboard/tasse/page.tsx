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
import { fromMinor } from '@/lib/money'
import {
  Landmark, TrendingDown, Briefcase, PiggyBank,
  Receipt, Calculator, AlertTriangle, User, Lightbulb,
} from 'lucide-react'
import { Breadcrumb, Card, Stat, Badge, DataCard, DataCardHeader, DataRow } from '@/components/ui'
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

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-[--brand-text]" strokeWidth={1.75} />
      <h2 className="text-base font-semibold text-[--ink]">{title}</h2>
    </div>
  )
}

// ── Tipi Props ────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{ year?: string; quarterly?: string }>
}

// ── Pagina ────────────────────────────────────────────────────────────────────

export default async function TassePage({ searchParams }: Props) {
  const user      = await requireUser()
  const params    = await searchParams
  const today     = new Date()
  const currentYear = today.getFullYear().toString()
  const year         = params.year ?? currentYear
  const isQuarterly  = params.quarterly === '1'
  const years        = taxYears(user.id)

  // Dati fiscali in parallelo (le funzioni async usano Promise.all dove possibile)
  const [realizedTax, latentTax, wealthTaxes, harvestingRecs] = await Promise.all([
    realizedTaxForYear(user.id, year),
    latentTaxStats(user.id).catch(() => null),
    estimatedWealthTaxes(user.id, year).catch(() => null),
    generateHarvestingRecommendations(user.id).catch(() => []),
  ])

  // Funzioni sincrone
  const fiscalWallet    = computeFiscalWallet(user.id)
  const interestTotal   = totalInterestWithholding(user.id)
  const profile         = getUserProfile(user.id)
  const incomeTax       = estimateIncomeTax(profile)

  // Portafogli per simulatore vendita
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

  // Riepilogo totale carico fiscale
  const totalTaxMinor = realizedTax.totalTaxDueMinor
    + (wealthTaxes?.totalMinor ?? 0)
    + interestTotal.withholdingMinor

  const hasRealizedActivity = realizedTax.events.length > 0

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-12">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Tasse' },
      ]} />

      {/* ── Titolo + selettore anno ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Landmark className="size-5 text-[--brand-text]" strokeWidth={1.75} />
          <h1 className="text-xl font-bold text-[--ink]">Gestione tasse — {year}</h1>
        </div>
        <YearSelector years={years} selectedYear={year} />
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SEZIONE 1: Riepilogo carico fiscale                               */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <SectionHeader icon={Receipt} title={`Riepilogo carico fiscale ${year}`} />

        <Card className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">Totale stimato {year}</p>
              <p className="text-3xl font-bold font-mono tabular-nums text-[--danger] mt-1">
                {fmtEur(totalTaxMinor)}
              </p>
            </div>
            <Badge variant="warning">stima</Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
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
              label="Imposte patrimoniali (bollo/IVAFE)"
              value={wealthTaxes ? fmtBollo(wealthTaxes.totalMinor) : '—'}
              size="sm"
              sub={wealthTaxes?.stale ? 'cambio BCE parziale' : undefined}
            />
            <Stat
              label="Ritenuta interessi (26%)"
              value={interestTotal.accountCount > 0 ? fmtEur(interestTotal.withholdingMinor) : '—'}
              size="sm"
              sub={interestTotal.accountCount > 0
                ? `su ${interestTotal.accountCount} ${interestTotal.accountCount === 1 ? 'conto' : 'conti'}`
                : 'nessun tasso impostato'}
            />
          </div>

          <p className="text-xs text-[--faint]">
            Stima informativa. Non costituisce consulenza fiscale. Rivolgiti a un commercialista per la dichiarazione dei redditi.
          </p>
        </Card>
      </section>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SEZIONE 2: Plus/minus realizzate                                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <SectionHeader icon={TrendingDown} title={`Plus/minusvalenze realizzate ${year}`} />

        {!hasRealizedActivity ? (
          <Card>
            <p className="text-sm text-[--muted]">Nessuna vendita registrata nel {year}.</p>
          </Card>
        ) : (
          <>
            {realizedTax.stale && (
              <div className="flex items-start gap-2 rounded-xl border border-[--warning] bg-[--surface-2] px-4 py-3 text-xs text-[--muted]">
                <AlertTriangle className="size-4 text-[--warning] shrink-0 mt-0.5" strokeWidth={1.75} />
                <span>Conversione valuta non disponibile per alcuni eventi — valori in EUR approssimati.</span>
              </div>
            )}

            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat
                label="Plusvalenze lorde"
                value={fmtEur(realizedTax.grossGainMinor)}
                size="sm"
              />
              <Stat
                label="Minusvalenze"
                value={realizedTax.lossMinor > 0 ? `−${fmtEur(realizedTax.lossMinor)}` : '—'}
                size="sm"
              />
              <Stat
                label="Compensazione zainetto"
                value={realizedTax.compensatedMinor > 0 ? `−${fmtEur(realizedTax.compensatedMinor)}` : '—'}
                size="sm"
              />
              <Stat
                label={`Imposta dovuta ${year}`}
                value={fmtEur(realizedTax.totalTaxDueMinor)}
                size="sm"
              />
            </div>

            {/* Franchigia cripto */}
            {realizedTax.cryptoGainMinor > 0 && (
              <Card className={realizedTax.cryptoExempt ? 'border-[--brand] bg-[--brand-subtle]' : ''}>
                <p className="text-sm font-medium text-[--ink]">
                  {realizedTax.cryptoExempt
                    ? `✓ Plusvalenze cripto ${year}: ${fmtEur(realizedTax.cryptoGainMinor)} — sotto la franchigia di €2.000, esenti da imposta.`
                    : `Plusvalenze cripto ${year}: ${fmtEur(realizedTax.cryptoGainMinor)} — sopra la franchigia di €2.000, imposta dovuta.`}
                </p>
                <p className="text-xs text-[--muted] mt-1">Art. 67 c. 1 lett. c-sexies TUIR — D.Lgs. 461/1997</p>
              </Card>
            )}

            {/* Tabella eventi — desktop */}
            <div className="hidden sm:block">
              <Card noPadding className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[--border] bg-[--surface-2]">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-[--muted]">Data</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-[--muted]">Strumento</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-[--muted]">Tipo</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-[--muted]">P/L EUR</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-[--muted]">Aliquota</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-[--muted]">Imposta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[--border]">
                      {realizedTax.events.map((ev, i) => (
                        <tr key={i} className="hover:bg-[--surface-2] transition-colors duration-100">
                          <td className="px-4 py-2.5 text-xs text-[--muted] whitespace-nowrap">{ev.date}</td>
                          <td className="px-4 py-2.5 text-xs text-[--ink] max-w-[200px] truncate">{ev.instrumentName}</td>
                          <td className="px-4 py-2.5">
                            <Badge variant={ev.incomeType === 'capitale' ? 'info' : 'neutral'}>
                              {ev.cluster}
                            </Badge>
                          </td>
                          <td className={`px-4 py-2.5 text-right text-xs font-mono tabular-nums font-medium ${ev.gainEurMinor >= 0 ? 'text-[--brand-text]' : 'text-[--danger]'}`}>
                            {sign(ev.gainEurMinor)}{fmtEurDec(ev.gainEurMinor)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs text-[--muted]">
                            {ev.gainEurMinor > 0 ? fmtPct(ev.appliedRate) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs font-mono tabular-nums">
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
              </Card>
            </div>

            {/* Tabella eventi — mobile card */}
            <div className="sm:hidden space-y-2">
              {realizedTax.events.map((ev, i) => (
                <DataCard key={i}>
                  <DataCardHeader
                    title={ev.instrumentName}
                    subtitle={ev.date}
                    badge={
                      <Badge variant={ev.incomeType === 'capitale' ? 'info' : 'neutral'}>
                        {ev.cluster}
                      </Badge>
                    }
                  />
                  <div className="divide-y divide-[--border]">
                    <DataRow label="P/L EUR">
                      <span className={`font-mono tabular-nums font-medium ${ev.gainEurMinor >= 0 ? 'text-[--brand-text]' : 'text-[--danger]'}`}>
                        {sign(ev.gainEurMinor)}{fmtEurDec(ev.gainEurMinor)}
                      </span>
                    </DataRow>
                    <DataRow label="Imposta">
                      {ev.taxMinor > 0
                        ? <span className="text-[--danger] tabular-nums">−{fmtEurDec(ev.taxMinor)}</span>
                        : ev.gainEurMinor < 0
                          ? <span className="text-[--brand-text]">credito</span>
                          : <span className="text-[--faint]">esente</span>}
                    </DataRow>
                    {ev.gainEurMinor > 0 && (
                      <DataRow label="Aliquota">
                        <span className="text-[--muted]">{fmtPct(ev.appliedRate)}</span>
                      </DataRow>
                    )}
                  </div>
                </DataCard>
              ))}
            </div>

            <p className="text-xs text-[--faint]">
              Plus/minus calcolate con metodo FIFO. La compensazione è basata sullo stato corrente dello zainetto fiscale.
              Per anni passati la compensazione mostrata è una stima. Art. 68 TUIR — D.Lgs. 461/1997.
            </p>
          </>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SEZIONE 3: Zainetto fiscale                                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <SectionHeader icon={Briefcase} title="Zainetto fiscale — minusvalenze in portafoglio" />

        {fiscalWallet.totalCreditMinor === 0 && fiscalWallet.expiredCreditMinor === 0 ? (
          <Card>
            <p className="text-sm text-[--muted]">Nessuna minusvalenza disponibile nello zainetto fiscale.</p>
          </Card>
        ) : (
          <>
            {/* Avviso crediti in scadenza */}
            {fiscalWallet.expiringThisYearMinor > 0 && (
              <Card className="border-[--warning] bg-[--surface-2]">
                <p className="text-sm font-medium text-[--ink]">
                  ⚠️ Hai{' '}
                  <strong>{fromMinor(fiscalWallet.expiringThisYearMinor, 'EUR')}</strong>{' '}
                  di minusvalenze in scadenza il 31/12 di quest&apos;anno.
                </p>
                <p className="mt-1 text-xs text-[--muted]">
                  Realizzando perdite su posizioni in rosso entro il 31 dicembre puoi
                  rinnovare la validità del credito fiscale per altri 4 anni,
                  evitando di perdere il beneficio (Art. 68 TUIR).
                </p>
              </Card>
            )}

            {/* KPI zainetto */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {fiscalWallet.totalCreditMinor > 0 && (
                <Card className="space-y-0.5">
                  <p className="text-xs text-[--muted]">Credito totale disponibile</p>
                  <p className="text-base font-bold font-mono tabular-nums text-[--brand-text]">
                    {fromMinor(fiscalWallet.totalCreditMinor, 'EUR')}
                  </p>
                  <p className="text-xs text-[--faint]">compensabile con future plusvalenze</p>
                </Card>
              )}
              {fiscalWallet.expiringThisYearMinor > 0 && (
                <Card className="space-y-0.5 border-[--warning]">
                  <p className="text-xs text-[--muted]">In scadenza quest&apos;anno</p>
                  <p className="text-base font-bold font-mono tabular-nums text-[--warning]">
                    {fromMinor(fiscalWallet.expiringThisYearMinor, 'EUR')}
                  </p>
                  <p className="text-xs text-[--faint]">entro 31/12</p>
                </Card>
              )}
              {fiscalWallet.expiredCreditMinor > 0 && (
                <Card className="space-y-0.5">
                  <p className="text-xs text-[--muted]">Crediti scaduti</p>
                  <p className="text-base font-bold font-mono tabular-nums text-[--faint]">
                    {fromMinor(fiscalWallet.expiredCreditMinor, 'EUR')}
                  </p>
                  <p className="text-xs text-[--faint]">non più utilizzabili</p>
                </Card>
              )}
            </div>

            {/* Lista crediti attivi — desktop */}
            {fiscalWallet.credits.length > 0 && (
              <>
                <div className="hidden sm:block">
                  <Card noPadding className="overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[--border] bg-[--surface-2]">
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-[--muted]">Data realizzo</th>
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-[--muted]">Scadenza</th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-[--muted]">Credito residuo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[--border]">
                          {fiscalWallet.credits.map((c, i) => {
                            const isExpiringThisYear = c.expiryDate.startsWith(currentYear)
                            return (
                              <tr key={i} className={isExpiringThisYear ? 'bg-[--warning-subtle]' : ''}>
                                <td className="px-4 py-2.5 text-xs text-[--muted]">{c.realizedDate}</td>
                                <td className="px-4 py-2.5 text-xs">
                                  <span className={isExpiringThisYear ? 'text-[--warning] font-medium' : 'text-[--muted]'}>
                                    {c.expiryDate}
                                    {isExpiringThisYear && ' ⚠️'}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-right text-xs font-mono tabular-nums text-[--brand-text] font-medium">
                                  {fromMinor(c.amountMinor, 'EUR')}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>

                {/* Lista crediti attivi — mobile card */}
                <div className="sm:hidden space-y-2">
                  {fiscalWallet.credits.map((c, i) => {
                    const isExpiringThisYear = c.expiryDate.startsWith(currentYear)
                    return (
                      <DataCard key={i} className={isExpiringThisYear ? 'border-[--warning]' : undefined}>
                        <DataCardHeader
                          title={fromMinor(c.amountMinor, 'EUR')}
                          subtitle={`Realizzo: ${c.realizedDate}`}
                          badge={isExpiringThisYear ? <span className="text-[--warning]">⚠️</span> : undefined}
                        />
                        <DataRow label="Scadenza">
                          <span className={isExpiringThisYear ? 'text-[--warning] font-medium' : 'text-[--muted]'}>
                            {c.expiryDate}
                            {isExpiringThisYear && ' in scadenza'}
                          </span>
                        </DataRow>
                      </DataCard>
                    )
                  })}
                </div>
              </>
            )}

            <p className="text-xs text-[--faint]">
              Le minusvalenze (redditi diversi) sono compensabili con future plusvalenze entro 4 anni dalla realizzo.
              Le minusvalenze da ETF generano credito; le plusvalenze da ETF (reddito di capitale) non lo consumano.
              Art. 68 TUIR — D.Lgs. 461/1997.
            </p>
          </>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SEZIONE 3.5: Tax-Loss Harvesting — suggerimenti proattivi         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {harvestingRecs.length > 0 && (
        <section className="space-y-6">
          <SectionHeader icon={Lightbulb} title="Ottimizzazione fiscale — Tax-Loss Harvesting" />

          <div className="space-y-3">
            {harvestingRecs.map((rec, i) => {
              const isExpiry   = rec.type === 'EXTEND_EXPIRY'
              const borderCls  = isExpiry
                ? 'border-[--warning] bg-[--surface-2]'
                : 'border-[--border] bg-[--surface-2]'

              return (
                <Card key={i} className={`space-y-3 ${borderCls}`}>
                  {/* Header badge + asset */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge variant={isExpiry ? 'warning' : 'info'}>
                        {isExpiry ? '⚠️ Credito in scadenza' : '💡 Genera credito'}
                      </Badge>
                      <span className="text-sm font-semibold text-[--ink]">
                        {rec.assetName}
                      </span>
                      <span className="text-xs font-mono text-[--muted]">{rec.ticker}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[--muted]">
                        {isExpiry ? 'Risparmio immediato' : 'Credito futuro'}
                      </p>
                      <p className={`text-base font-bold font-mono tabular-nums ${isExpiry ? 'text-[--warning]' : 'text-[--brand-text]'}`}>
                        {fmtEur(rec.taxImpactMinor)}
                      </p>
                    </div>
                  </div>

                  {/* Testo esplicativo */}
                  <p className="text-xs text-[--muted] leading-relaxed">{rec.actionText}</p>

                  {/* KPI row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[--faint]">Portafoglio</p>
                      <p className="text-xs font-medium text-[--ink] mt-0.5">{rec.portfolioName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[--faint]">Qt. suggerita</p>
                      <p className="text-xs font-mono font-medium text-[--ink] mt-0.5">{rec.suggestedQty} / {rec.remainingQty}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-[--faint]">
                        {rec.latentPlEurMinor >= 0 ? 'Plusvalenza latente' : 'Minusvalenza latente'}
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
          </div>

          <p className="text-xs text-[--faint]">
            Suggerimenti automatici basati sul tuo zainetto fiscale e le posizioni aperte.
            La vendita e il riacquisto immediato sono legali in Italia (non esiste una wash-sale rule).
            Verifica le commissioni del tuo broker prima di procedere. Non costituisce consulenza fiscale.
          </p>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SEZIONE 4: Tasse latenti                                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <SectionHeader icon={TrendingDown} title="Tasse latenti sugli investimenti" />

        {!latentTax || latentTax.latentTaxMinor === 0 ? (
          <Card>
            <p className="text-sm text-[--muted]">
              Nessuna tassa latente stimata (nessuna plusvalenza non realizzata nelle posizioni aperte).
            </p>
          </Card>
        ) : (
          <Card className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              <Stat
                label="Investimenti lordi"
                value={fmtEur(latentTax.grossInvestmentMinor)}
                size="sm"
              />
              <Stat
                label="Tasse latenti stimate"
                value={`−${fmtEur(latentTax.latentTaxMinor)}`}
                size="sm"
              />
              <Stat
                label="Valore netto reale"
                value={fmtEur(latentTax.netInvestmentMinor)}
                size="sm"
              />
            </div>
            <p className="text-xs text-[--faint]">
              Stima teorica se vendessi oggi tutte le posizioni in guadagno. Aliquota specifica per strumento (12,5%–26%).
              Non considera la compensazione con lo zainetto fiscale.
            </p>
          </Card>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SEZIONE 5: Imposte patrimoniali (bollo/IVAFE)                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <SectionHeader icon={Landmark} title={`Imposte patrimoniali ${year}`} />
          <BolloToggle />
        </div>

        {/* Avviso residenza fiscale estera */}
        {profile.taxResidency && profile.taxResidency.toUpperCase() !== 'IT' && (
          <div className="flex items-start gap-2 rounded-xl border border-[--warning]/40 bg-[--warning]/10 px-4 py-3">
            <AlertTriangle className="size-4 text-[--warning] shrink-0 mt-0.5" />
            <p className="text-xs text-[--muted]">
              Residenza fiscale <strong>{profile.taxResidency.toUpperCase()}</strong>: bollo e IVAFE italiani
              potrebbero non applicarsi. I valori seguenti sono calcolati come se fossi residente in Italia
              (basati sul Paese dell&apos;intermediario) e sono da considerare indicativi.{' '}
              <Link href="/dashboard/profilo" className="text-[--brand-text] hover:underline">Modifica profilo →</Link>
            </p>
          </div>
        )}

        {!wealthTaxes || wealthTaxes.totalMinor === 0 ? (
          <Card>
            <p className="text-sm text-[--muted]">
              Nessuna imposta patrimoniale stimata per il {year}
              {!wealthTaxes ? ' (calcolo non disponibile)' : ' (giacenza media ≤ €5.000 su tutti i conti, nessun titolo)' }.
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
              <div className="divide-y divide-[--border] rounded-xl border border-[--border] overflow-hidden">
                {wealthTaxes.lines.filter(l => l.taxEurMinor > 0).map((line) => (
                  <div key={`${line.kind}-${line.id}`} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-4 py-2.5 text-xs">
                    <span className="flex-1 text-[--ink] font-medium">{line.name}</span>
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <span className="text-[--muted]">
                        {line.kind === 'account'
                          ? `giacenza media ${fmtEur(line.baseEurMinor)}`
                          : `controvalore ${fmtEur(line.baseEurMinor)}`}
                      </span>
                      <span className="font-mono tabular-nums text-[--ink] font-medium">
                        {fmtBollo(isQuarterly ? line.taxEurMinor / 4 : line.taxEurMinor)}
                        {isQuarterly && <span className="text-[--muted] font-normal">/trim.</span>}
                      </span>
                      <span className={`uppercase tracking-wide font-semibold ${line.regime === 'ivafe' ? 'text-[--brand-text]' : 'text-[--muted]'}`}>
                        {line.regime}
                      </span>
                      {line.stale && <span className="text-[--warning]">*</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-[--faint]">
              Bollo conti: €34,20/anno fissi se giacenza media &gt; €5.000 (Art. 13 c. 2-bis DPR 642/1972).
              Bollo/IVAFE titoli: 0,2% del controvalore al 31/12. IVAFE per intermediari esteri (Art. 19 c. 18 DL 201/2011).
              {isQuarterly && ' La vista trimestrale divide il totale annuo per 4 — la frequenza reale dipende dall\'intermediario.'}
            </p>
          </Card>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SEZIONE 6: Ritenuta interessi                                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <SectionHeader icon={PiggyBank} title="Ritenuta sugli interessi" />

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
            <p className="text-xs text-[--faint]">
              Ritenuta a titolo d&apos;imposta del 26% sugli interessi da deposito (Art. 26 DPR 600/1973).
              Stima basata sulla giacenza corrente e sul tasso impostato — non sulla giacenza media dell&apos;anno.
            </p>
          </Card>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SEZIONE 7: Imposte sul reddito (IRPEF) — stima                   */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
        <SectionHeader icon={User} title="Imposte sul reddito (IRPEF) — stima" />

        {!incomeTax.applicable ? (
          <Card className="flex items-start gap-3">
            <AlertTriangle className="size-4 text-[--warning] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm text-[--muted]">
                {incomeTax.note ?? 'Dati insufficienti per la stima IRPEF.'}
              </p>
              <Link href="/dashboard/profilo" className="text-xs text-[--brand-text] hover:underline">
                Completa il profilo →
              </Link>
            </div>
          </Card>
        ) : incomeTax.totalMinor === 0 ? (
          <Card>
            <p className="text-sm text-[--muted]">
              {incomeTax.note ?? 'Inserisci il reddito lordo nel profilo per calcolare la stima.'}
            </p>
            <Link href="/dashboard/profilo" className="text-xs text-[--brand-text] hover:underline mt-1 block">
              Vai al profilo →
            </Link>
          </Card>
        ) : (
          <Card className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              <Stat label="Imponibile"        value={fmtEurDec(incomeTax.taxableMinor)} size="sm" />
              {incomeTax.irpefMinor > 0 && (
                <Stat label="IRPEF"           value={fmtEurDec(incomeTax.irpefMinor)}  size="sm" />
              )}
              {incomeTax.substituteMinor > 0 && (
                <Stat label="Imposta sost."   value={fmtEurDec(incomeTax.substituteMinor)} size="sm" />
              )}
              {incomeTax.addizionaliMinor > 0 && (
                <Stat label="Addizionali"     value={fmtEurDec(incomeTax.addizionaliMinor)} size="sm" />
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
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SEZIONE 8: Simulatore di vendita                                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-6">
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
