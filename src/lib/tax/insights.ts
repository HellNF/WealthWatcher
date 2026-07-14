// src/lib/tax/insights.ts — Motore delle "Considerazioni fiscali".
// Trasforma le statistiche fiscali già calcolate (nessuna query nuova) in una lista
// ordinata di insight narrativi in italiano, ciascuno con il *perché* e l'impatto in €.
// Regola d'oro (come src/lib/insights.ts): sotto la soglia di materialità, il motore tace.
import type { Insight } from '@/lib/insights'
import type { RealizedYearTax } from './annual'
import type { FiscalWallet } from './wallet'
import type { LatentTaxStats } from './latent'
import type { WealthTaxStats } from './wealth'
import type { PensionTaxStatus } from './pension'
import { cryptoRate } from './rates'

export interface TaxInsightInputs {
  /** Anno fiscale selezionato (stringa YYYY). */
  year:         string
  realizedTax:  RealizedYearTax
  fiscalWallet: FiscalWallet
  latentTax:    LatentTaxStats | null
  wealthTaxes:  WealthTaxStats | null
  pension:      PensionTaxStatus
}

// ── Formattazione (server-side, it-IT) ────────────────────────────────────────

function eur(minor: number, decimals = 0): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  })
}
function pct(rate: number, decimals = 0): string {
  return (rate * 100).toLocaleString('it-IT', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }) + '%'
}

// Soglia di materialità generica sugli importi d'imposta (€10).
const MATERIALITY_MINOR = 1_000
// Aliquota rappresentativa per stimare il valore d'imposta di un credito lordo (26%).
const REPRESENTATIVE_RATE = 0.26

const SEVERITY_ORDER = { critical: 0, warn: 1, opportunity: 2, info: 3 } as const
const MAX_TAX_INSIGHTS = 6

/**
 * Genera le considerazioni fiscali ordinate (severity, poi impatto).
 * Input = statistiche già calcolate nella pagina; nessun accesso al DB.
 */
export function computeTaxInsights(inputs: TaxInsightInputs): Insight[] {
  const { year, realizedTax, fiscalWallet, latentTax, wealthTaxes, pension } = inputs
  const yearNum = parseInt(year, 10)
  const out: Insight[] = []

  // ── warn: minusvalenze in scadenza il 31/12 ────────────────────────────────
  // Lo zainetto memorizza la perdita LORDA; il valore d'imposta si stima ad aliquota
  // rappresentativa (26%). È la leva più urgente: dopo il 31/12 il credito è perso.
  if (fiscalWallet.expiringThisYearMinor > 0) {
    const taxValue = Math.round(fiscalWallet.expiringThisYearMinor * REPRESENTATIVE_RATE)
    out.push({
      id: 'wallet-expiring',
      severity: taxValue >= 50_000 ? 'critical' : 'warn',
      icon: 'calendar',
      title: 'Minusvalenze in scadenza il 31 dicembre',
      body: `Hai ${eur(fiscalWallet.expiringThisYearMinor)} di minusvalenze che scadono il 31/12/${year}: `
          + `dopo, il credito è perso. Realizzando plusvalenze "diverse" (azioni, obbligazioni, ETC, cripto) `
          + `entro fine anno le compensi e risparmi fino a ~${eur(taxValue)} d'imposta. `
          + `Attenzione: le plusvalenze da ETF sono reddito di capitale e non assorbono questo credito.`,
      impactMinor: taxValue,
      impactLabel: `fino a ${eur(taxValue)} recuperabili`,
    })
  }

  // ── info: asimmetria ETF (plus non compensabile) ───────────────────────────
  // Il punto non banale: la plus ETF è reddito di capitale (mai compensabile), mentre
  // la minus ETF è reddito diverso (entra nello zainetto). Vale se ci sono plus ETF tassate.
  const etfCapitalTaxMinor = realizedTax.events
    .filter(ev => ev.incomeType === 'capitale' && ev.taxMinor > 0)
    .reduce((s, ev) => s + ev.taxMinor, 0)
  if (etfCapitalTaxMinor >= MATERIALITY_MINOR) {
    out.push({
      id: 'etf-asymmetry',
      severity: 'info',
      icon: 'scale',
      title: 'Perché le plusvalenze ETF non abbattono le tue minus',
      body: `Nel ${year} hai pagato ${eur(etfCapitalTaxMinor)} su plusvalenze da ETF: sono "reddito di `
          + `capitale" e per legge non si compensano con nessuna minusvalenza. Le minus da ETF, al contrario, `
          + `finiscono nello zainetto e valgono contro plus di azioni, obbligazioni, ETC e cripto — ma mai `
          + `contro altre plus di ETF. È un'asimmetria voluta dal legislatore, non un errore.`,
      impactMinor: etfCapitalTaxMinor,
      impactLabel: `${eur(etfCapitalTaxMinor)} non compensabili`,
    })
  }

  // ── info: cripto — franchigia abolita e aliquota 33% dal 2026 ───────────────
  if (realizedTax.cryptoGainMinor > 0) {
    if (yearNum >= 2026) {
      const delta = Math.round(realizedTax.cryptoGainMinor * (cryptoRate(yearNum) - 0.26))
      out.push({
        id: 'crypto-2026',
        severity: 'info',
        icon: 'coins',
        title: 'Cripto: aliquota salita al 33% dal 2026',
        body: `Dal 2026 le plusvalenze su criptoattività sono tassate al ${pct(cryptoRate(yearNum))} (prima 26%) `
            + `e la vecchia franchigia di €2.000 è abolita fin dal 2025. Sui tuoi ${eur(realizedTax.cryptoGainMinor)} `
            + `di guadagni cripto realizzati sono circa ${eur(delta)} in più rispetto alla vecchia aliquota.`,
        impactMinor: delta,
        impactLabel: `~${eur(delta)} in più vs 26%`,
      })
    } else if (yearNum === 2025) {
      out.push({
        id: 'crypto-2025',
        severity: 'info',
        icon: 'coins',
        title: 'Cripto: franchigia €2.000 abolita dal 2025',
        body: `Dal 2025 non esiste più la franchigia di €2.000 sulle plusvalenze cripto: ogni guadagno è `
            + `tassabile al 26%. Sui tuoi ${eur(realizedTax.cryptoGainMinor)} realizzati non c'è più soglia di `
            + `esenzione, e dal 2026 l'aliquota salirà al 33%.`,
        impactMinor: realizedTax.cryptoGainMinor,
      })
    }
  }

  // ── opportunity: fondo pensione non saturato ───────────────────────────────
  if (pension.marginalRate !== null
      && pension.remainingDeductibleSpaceMinor > 0
      && pension.potentialTaxRefundRemainingMinor >= MATERIALITY_MINOR) {
    out.push({
      id: 'pension-space',
      severity: 'opportunity',
      icon: 'piggy',
      title: 'Spazio di deduzione previdenza non usato',
      body: `Ti restano ${eur(pension.remainingDeductibleSpaceMinor)} di versamenti deducibili al fondo `
          + `pensione entro il 31/12/${year}. Alla tua aliquota marginale del ${pct(pension.marginalRate)} `
          + `valgono ${eur(pension.potentialTaxRefundRemainingMinor)} di IRPEF risparmiata.`,
      impactMinor: pension.potentialTaxRefundRemainingMinor,
      impactLabel: `${eur(pension.potentialTaxRefundRemainingMinor)} di IRPEF`,
      href: '/dashboard/settings',
    })
  }

  // ── opportunity: zainetto disponibile (non in scadenza immediata) ───────────
  const availableNotExpiring = fiscalWallet.totalCreditMinor - fiscalWallet.expiringThisYearMinor
  if (availableNotExpiring > 0) {
    const taxValue = Math.round(availableNotExpiring * REPRESENTATIVE_RATE)
    if (taxValue >= MATERIALITY_MINOR) {
      out.push({
        id: 'wallet-available',
        severity: 'opportunity',
        icon: 'coins',
        title: 'Credito fiscale disponibile nello zainetto',
        body: `Hai ${eur(availableNotExpiring)} di minusvalenze ancora spendibili (oltre a quelle in `
            + `scadenza). Compensano future plusvalenze "diverse" e possono valere fino a ~${eur(taxValue)} `
            + `d'imposta risparmiata, se realizzi guadagni prima della loro scadenza.`,
        impactMinor: taxValue,
        impactLabel: `~${eur(taxValue)} di credito`,
      })
    }
  }

  // ── info: peso della tassazione latente sul portafoglio ────────────────────
  if (latentTax && latentTax.grossInvestmentMinor > 0 && latentTax.latentTaxMinor >= MATERIALITY_MINOR) {
    const ratio = latentTax.latentTaxMinor / latentTax.grossInvestmentMinor
    if (ratio >= 0.03) {
      out.push({
        id: 'latent-weight',
        severity: 'info',
        icon: 'trend',
        title: 'Il tuo patrimonio reale al netto del fisco',
        body: `Se vendessi oggi tutte le posizioni in guadagno pagheresti ${eur(latentTax.latentTaxMinor)} `
            + `di imposta sostitutiva (${pct(ratio, 1)} del valore lordo). Il valore "reale" spendibile dei tuoi `
            + `investimenti è quindi ${eur(latentTax.netInvestmentMinor)}, non ${eur(latentTax.grossInvestmentMinor)}.`,
        impactMinor: latentTax.latentTaxMinor,
        impactLabel: `${eur(latentTax.latentTaxMinor)} latenti`,
      })
    }
  }

  // ── info: IVAFE su strumenti esteri (monitoraggio RW) ──────────────────────
  if (wealthTaxes && wealthTaxes.totalIvafeMinor >= MATERIALITY_MINOR) {
    out.push({
      id: 'ivafe-foreign',
      severity: 'info',
      icon: 'scale',
      title: 'Hai attività estere: occhio al quadro RW',
      body: `Paghi ${eur(wealthTaxes.totalIvafeMinor)} di IVAFE su conti/titoli presso intermediari esteri. `
          + `Le stesse attività vanno dichiarate nel quadro RW per il monitoraggio fiscale: per le cripto `
          + `l'obbligo scatta dal primo euro, senza la soglia di €10.000 valida per i conti esteri.`,
      impactMinor: wealthTaxes.totalIvafeMinor,
      impactLabel: `${eur(wealthTaxes.totalIvafeMinor)} IVAFE`,
    })
  }

  out.sort((a, b) =>
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    || b.impactMinor - a.impactMinor,
  )
  return out.slice(0, MAX_TAX_INSIGHTS)
}
