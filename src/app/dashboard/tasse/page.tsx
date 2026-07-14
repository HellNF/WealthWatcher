// Pagina Tasse — gestione fiscale con due livelli di lettura (Essenziale / Avanzata).
// Essenziale: verdetto + considerazioni fiscali narrative (il "perché", non solo i numeri).
// Avanzata: sblocca tabelle di dettaglio, patrimoniali per strumento, IRPEF/previdenza,
// tax-loss harvesting e simulatore. Ogni sezione cita la sua fonte (istituzionale).
import { requireUser } from '@/lib/dal'
import { realizedTaxForYear, taxYears } from '@/lib/tax/annual'
import { computeFiscalWallet } from '@/lib/tax/wallet'
import { latentTaxStats } from '@/lib/tax/latent'
import { estimatedWealthTaxes } from '@/lib/tax/wealth'
import { generateHarvestingRecommendations } from '@/lib/tax/harvesting'
import { computeTaxInsights } from '@/lib/tax/insights'
import { totalInterestWithholding } from '@/lib/accounts'
import { listPortfolios } from '@/lib/portfolios'
import { getPortfolioPositions } from '@/lib/positions'
import { getUserProfile } from '@/lib/userSettings'
import { estimateIncomeTax } from '@/lib/tax/income'
import { getPensionTaxStatus } from '@/lib/tax/pension'
import type { Insight } from '@/lib/insights'
import {
  Landmark, Briefcase, PiggyBank, Calculator, Lightbulb, Coins, Sparkles,
} from 'lucide-react'
import { Breadcrumb, Card, Stat, InsightCard } from '@/components/ui'
import Link from 'next/link'
import YearSelector from './YearSelector'
import ViewToggle from './ViewToggle'
import SaleSimulatorSection from './SaleSimulatorSection'
import BolloToggle from './BolloToggle'
import TaxVerdict, { type VerdictStat } from './TaxVerdict'
import SectionHeading from './SectionHeading'
import SourceLink from './SourceLink'
import RealizedSection from './RealizedSection'
import WealthTaxSection from './WealthTaxSection'
import PensionSection from './PensionSection'
import { ETF_ASYMMETRY_SOURCE } from './sources'
import { fmtEur } from './format'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ year?: string; quarterly?: string; vista?: string }>
}

export default async function TassePage({ searchParams }: Props) {
  const user        = await requireUser()
  const params      = await searchParams
  const currentYear = new Date().getFullYear().toString()
  const year        = params.year ?? currentYear
  const isQuarterly = params.quarterly === '1'
  const isAdvanced  = params.vista === 'avanzata'
  const yearNum     = parseInt(year, 10)
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
  const incomeTax     = estimateIncomeTax(profile, yearNum)
  const pensionStatus = getPensionTaxStatus(user.id, year)

  const totalTaxMinor = realizedTax.totalTaxDueMinor
    + (wealthTaxes?.totalMinor ?? 0)
    + interestTotal.withholdingMinor

  const hasRealizedActivity = realizedTax.events.length > 0

  // ── Considerazioni fiscali (motore narrativo) ──────────────────────────────
  const insights = computeTaxInsights({
    year, realizedTax, fiscalWallet,
    latentTax, wealthTaxes, pension: pensionStatus,
  })

  // ── Verdetto: headline in linguaggio naturale + leva principale ────────────
  const actionable = insights.find(i =>
    i.severity === 'critical' || i.severity === 'warn' || i.severity === 'opportunity')
  const headline = totalTaxMinor > 0
    ? `Nel ${year} il tuo carico fiscale stimato è ${fmtEur(totalTaxMinor)}.`
    : `Nel ${year} non risulta imposta stimata a tuo carico.`
  const detail = actionable
    ? `${actionable.title}${actionable.impactLabel ? ` — ${actionable.impactLabel}.` : '.'} `
      + `Le considerazioni qui sotto spiegano come intervenire.`
    : (!hasRealizedActivity && totalTaxMinor === 0)
      ? 'Registra le tue vendite e completa il profilo per una stima più precisa.'
      : undefined

  const verdictStats: VerdictStat[] = [
    {
      label: 'Su plus e redditi realizzati',
      value: fmtEur(realizedTax.totalTaxDueMinor),
      sub: realizedTax.compensatedMinor > 0 ? `dopo ${fmtEur(realizedTax.compensatedMinor)} compensati` : undefined,
      tone: 'danger',
    },
    {
      label: 'Patrimoniali (bollo/IVAFE)',
      value: wealthTaxes ? fmtEur(wealthTaxes.totalMinor) : '—',
      sub: wealthTaxes?.stale ? 'cambio BCE parziale' : undefined,
      tone: 'danger',
    },
    {
      label: 'Ritenuta interessi',
      value: interestTotal.accountCount > 0 ? fmtEur(interestTotal.withholdingMinor) : '—',
      tone: 'danger',
    },
    {
      label: 'Tassa latente',
      value: latentTax && latentTax.latentTaxMinor > 0 ? fmtEur(latentTax.latentTaxMinor) : '—',
      sub: latentTax && latentTax.latentTaxMinor > 0 ? 'se vendi oggi' : undefined,
    },
  ]

  // ── Portafogli per il simulatore (solo in vista avanzata) ──────────────────
  const portfoliosForSimulator = isAdvanced
    ? listPortfolios(user.id)
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
    : []

  // ── Tax-Loss Harvesting → insight card ─────────────────────────────────────
  const harvestingInsights: Insight[] = harvestingRecs.map((rec, i) => ({
    id:       `harvest-${i}`,
    severity: rec.type === 'EXTEND_EXPIRY' ? 'warn' : 'opportunity',
    icon:     rec.type === 'EXTEND_EXPIRY' ? 'calendar' : 'piggy',
    title:    rec.ticker ? `${rec.assetName} · ${rec.ticker}` : rec.assetName,
    body:     rec.actionText,
    impactMinor: rec.taxImpactMinor,
    impactLabel: `${rec.type === 'EXTEND_EXPIRY' ? 'Risparmio' : 'Credito futuro'} ${fmtEur(rec.taxImpactMinor)}`,
  }))

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Tasse' },
      ]} />

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <Landmark className="size-5 text-[--brand-text]" strokeWidth={1.75} />
          <h1 className="text-xl font-bold text-[--ink]">Gestione fiscale — {year}</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ViewToggle />
          <YearSelector years={years} selectedYear={year} />
        </div>
      </div>

      {/* ══ Verdetto (sempre) ═════════════════════════════════════════════════ */}
      <TaxVerdict
        headline={headline}
        detail={detail}
        totalLabel={`Carico fiscale stimato ${year}`}
        totalValue={fmtEur(totalTaxMinor)}
        stats={verdictStats}
      />

      {/* ══ Considerazioni fiscali (sempre) ═══════════════════════════════════ */}
      {insights.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <Sparkles className="size-4 text-[--brand-text]" strokeWidth={1.75} aria-hidden />
              <h2 className="text-base font-semibold text-[--ink]">Considerazioni fiscali</h2>
            </div>
            <SourceLink source={ETF_ASYMMETRY_SOURCE} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map(ins => (
              <InsightCard key={ins.id} insight={ins} />
            ))}
          </div>
        </section>
      )}

      {/* Disclaimer globale (unico) */}
      <p className="text-xs text-[--faint] leading-relaxed">
        Tutti gli importi sono <strong>stime informative</strong> calcolate sui dati inseriti e non
        costituiscono consulenza fiscale. Metodo FIFO, compensazione Art. 68 TUIR, imposta sostitutiva
        D.Lgs. 461/1997. Verifica sempre con un commercialista prima della dichiarazione dei redditi.
      </p>

      {/* ══ VISTA AVANZATA ════════════════════════════════════════════════════ */}
      {isAdvanced && (
        <div className="space-y-8 pt-2">
          {/* Plusvalenze e zainetto */}
          <section className="space-y-4">
            <SectionHeading icon={Briefcase} title={`Plusvalenze e zainetto ${year}`} source="capitalGain" />
            <RealizedSection
              year={year}
              currentYear={currentYear}
              realizedTax={realizedTax}
              fiscalWallet={fiscalWallet}
            />
          </section>

          {/* Imposte patrimoniali */}
          <section className="space-y-4">
            <SectionHeading
              icon={Landmark}
              title={`Imposte patrimoniali ${year}`}
              source="wealthDuty"
              actions={<BolloToggle />}
            />
            <WealthTaxSection
              year={year}
              isQuarterly={isQuarterly}
              wealthTaxes={wealthTaxes}
              taxResidency={profile.taxResidency}
            />
          </section>

          {/* Ritenuta interessi */}
          {interestTotal.accountCount > 0 && (
            <section className="space-y-4">
              <SectionHeading icon={Coins} title="Ritenuta sugli interessi" source="interest" />
              <Card className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                <Stat
                  label="Interesse lordo / anno"
                  value={fmtEur(interestTotal.grossAnnualMinor)}
                  sub={`su ${interestTotal.accountCount} ${interestTotal.accountCount === 1 ? 'conto' : 'conti'}`}
                  size="sm"
                />
                <Stat label="Ritenuta 26%" value={`−${fmtEur(interestTotal.withholdingMinor)}`} size="sm" />
                <Stat
                  label="Netto / anno"
                  value={fmtEur(interestTotal.netAnnualMinor)}
                  sub={`≈ ${fmtEur(Math.round(interestTotal.netAnnualMinor / 12))}/mese`}
                  size="sm"
                />
              </Card>
            </section>
          )}

          {/* Reddito e previdenza */}
          {(incomeTax.applicable && incomeTax.totalMinor > 0) || pensionStatus.marginalRate !== null ? (
            <section className="space-y-4">
              <SectionHeading icon={PiggyBank} title="Reddito e previdenza" source="pension" />
              <PensionSection year={year} incomeTax={incomeTax} pension={pensionStatus} />
            </section>
          ) : null}

          {/* Tax-Loss Harvesting */}
          {harvestingInsights.length > 0 && (
            <section className="space-y-4">
              <SectionHeading icon={Lightbulb} title="Tax-Loss Harvesting" source="capitalGain" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {harvestingInsights.map(ins => (
                  <InsightCard key={ins.id} insight={ins} />
                ))}
              </div>
              <p className="text-xs text-[--faint]">
                Suggerimenti automatici basati su zainetto e posizioni aperte. In Italia la vendita e il
                riacquisto immediato è legale (nessuna wash-sale rule). Verifica le commissioni del tuo broker.
              </p>
            </section>
          )}

          {/* Simulatore vendita */}
          <section className="space-y-4">
            <SectionHeading icon={Calculator} title="Simulatore vendita" source="capitalGain" />
            <p className="text-xs text-[--muted]">
              Calcola plusvalenza lorda, imposta sostitutiva e guadagno netto di una vendita ipotetica
              (metodo FIFO). Nessuna operazione viene registrata.
            </p>
            {portfoliosForSimulator.length === 0 ? (
              <Card>
                <p className="text-sm text-[--muted]">
                  Nessuna posizione aperta disponibile per la simulazione.{' '}
                  <Link href="/dashboard" className="text-[--brand-text] hover:underline">Vai alla dashboard</Link>{' '}
                  per aggiungere operazioni.
                </p>
              </Card>
            ) : (
              <Card>
                <SaleSimulatorSection portfolios={portfoliosForSimulator} />
              </Card>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
