// src/app/dashboard/tasse/sources.ts — Fonti normative contestuali per sezione.
// Priorità ai siti istituzionali (Agenzia delle Entrate, Normattiva, Brocardi per il testo TUIR).
// Ogni voce è un riferimento verificabile citato accanto alla sezione a cui si applica.

export interface TaxSource {
  /** Etichetta breve mostrata nel link (es. "Art. 68 TUIR"). */
  label: string
  href:  string
  /** true = fonte istituzionale/normativa primaria (badge dedicato). */
  official?: boolean
}

/** Chiavi tematiche delle sezioni fiscali. */
export type SourceTopic =
  | 'capitalGain'
  | 'wallet'
  | 'wealthDuty'
  | 'crypto'
  | 'pension'
  | 'irpef'
  | 'interest'

export const TAX_SOURCES: Record<SourceTopic, TaxSource> = {
  capitalGain: {
    label: 'Art. 67–68 TUIR · Quadro RT (AdE)',
    href: 'https://www.agenziaentrate.gov.it/portale/-/4-quadro-rt-45-plusvalenze-di-natura-finanziaria',
    official: true,
  },
  wallet: {
    label: 'Art. 68 c.5 TUIR',
    href: 'https://www.brocardi.it/testo-unico-imposte-redditi/titolo-i/capo-vii/art68.html',
    official: true,
  },
  wealthDuty: {
    label: 'Scheda IVAFE — Agenzia delle Entrate',
    href: 'https://www.agenziaentrate.gov.it/portale/schede/pagamenti/imposta-valore-att-estero-ivafe/base-imponibile-e-aliquote-scheda-ivafe',
    official: true,
  },
  crypto: {
    label: 'Cripto-attività — Agenzia delle Entrate',
    href: 'https://www.agenziaentrate.gov.it/portale/cripto-attivita',
    official: true,
  },
  pension: {
    label: 'Art. 10 TUIR — deducibilità previdenza',
    href: 'https://www.brocardi.it/testo-unico-imposte-redditi/titolo-i/capo-i/art10.html',
    official: true,
  },
  irpef: {
    label: 'IRPEF — Agenzia delle Entrate',
    href: 'https://www.agenziaentrate.gov.it/portale/web/guest/schede/dichiarazioni/redditi-persone-fisiche',
    official: true,
  },
  interest: {
    label: 'Art. 26 DPR 600/1973 — ritenute',
    href: 'https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.del.presidente.della.repubblica:1973-09-29;600',
    official: true,
  },
}

/** Fonte non istituzionale citata per l'asimmetria ETF (divulgativa, di supporto). */
export const ETF_ASYMMETRY_SOURCE: TaxSource = {
  label: 'La fiscalità degli ETF in Italia — justETF',
  href: 'https://www.justetf.com/it/news/etf/la-fiscalita-degli-etf-in-italia.html',
  official: false,
}
