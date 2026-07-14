// src/lib/marketOverview/analysis/types.ts — Tipi della sintesi di settore.
// Una SectorAnalysis interpola PIÙ indicatori (Driver) in una posizione
// direzionale argomentata. Tono: valutazione generale di contesto, mai
// raccomandazione personalizzata (vedi disclaimer di pagina).

/** Posizione direzionale su scala a 5 livelli. Neutra rispetto al singolo
 *  utente: descrive il CONTESTO storico, non cosa deve fare la persona. */
export type Stance =
  | 'accumulate'       // contesto storicamente favorevole all'accumulo
  | 'lean-accumulate'
  | 'neutral'
  | 'lean-caution'
  | 'caution'          // contesto teso

/** Lettura di un singolo driver dal punto di vista di chi valuta un ingresso. */
export type Reading = 'favorable' | 'neutral' | 'unfavorable'

export type Confidence = 'alta' | 'media' | 'bassa'

export interface Driver {
  label:   string   // es. "Valutazione (P/E)"
  detail:  string   // es. "23,4 · sopra la media storica" oppure "dato non disponibile"
  reading: Reading
  /** Punteggio normalizzato in [-1,+1]: +1 = condizioni storicamente favorevoli
   *  all'ingresso, −1 = sfavorevoli. NaN se il dato manca (peso 0 → ignorato). */
  score:   number
  weight:  number
  source:  string
  /** code del MarketSignal di supporto (per linkare il grafico). */
  signalCode?: string
}

export interface LearnMore {
  label: string
  href:  string
}

export interface SectorAnalysis {
  key:        string      // 'equities' | 'bonds' | 'commodities' | 'crypto' | id sotto-mercato
  title:      string
  stance:     Stance
  score:      number       // composito [-1,+1]
  confidence: Confidence
  headline:   string       // testo breve della stance
  narrative:  string       // paragrafo argomentato
  drivers:    Driver[]
  learnMore:  LearnMore[]
  asOf:       number
  /** Sotto-analisi (azionario: USA/Europa/Emergenti/Giappone/Tech). */
  subMarkets?: SectorAnalysis[]
}
