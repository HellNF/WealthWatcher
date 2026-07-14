// src/lib/calendar/types.ts — Modello dati dello scadenziario intelligente.
//
// Un DeadlineEvent non è più solo "una scadenza": porta la sua natura (cash /
// opportunità / informativo), la direzione di cassa, il livello di confidenza
// (certo, stimato, inferito) e — quando serve — una severità, un suggerimento e
// un deep-link. I campi legacy (date/source/label/amountMinor/id/meta) restano
// invariati per retro-compatibilità con i consumatori esistenti.
import type { Insight } from '@/lib/insights'

/** Fonti eventi. Le prime sei sono storiche; le altre sono i nuovi generatori. */
export type DeadlineSource =
  | 'bollo' | 'ivafe' | 'credito_fiscale' | 'rata_mutuo' | 'ricorrente' | 'custom'  // storiche
  | 'dividendo_atteso' | 'stipendio_atteso' | 'interessi_conto'                     // entrate inferite
  | 'obiettivo' | 'consenso_banca' | 'harvesting' | 'franchigia_crypto'             // opportunità/info

/**
 * Natura dell'evento:
 * - `cash`        → movimento monetario reale (impatta la liquidità proiettata)
 * - `opportunity` → azione con una scadenza (usare crediti, rinnovare consenso…)
 * - `info`        → pura consapevolezza (nessuna azione forzata, nessun movimento)
 */
export type DeadlineKind = 'cash' | 'opportunity' | 'info'

/** Direzione di cassa. Rilevante solo per `kind === 'cash'`. */
export type FlowDirection = 'out' | 'in' | 'none'

/**
 * Confidenza del dato:
 * - `certain`   → deterministico (rate mutuo, scadenze statutarie, eventi manuali)
 * - `estimated` → derivato da un tasso/regola (interessi conto, imposte patrimoniali)
 * - `inferred`  → inferito dallo storico (ricorrenti, dividendi, stipendio)
 */
export type Confidence = 'certain' | 'estimated' | 'inferred'

export type EventSeverity = 'critical' | 'warn' | 'opportunity' | 'info'

export interface DeadlineEvent {
  id?:          number          // presente solo per eventi custom (deletable)
  date:         string          // ISO YYYY-MM-DD
  source:       DeadlineSource
  kind:         DeadlineKind
  direction:    FlowDirection
  label:        string
  amountMinor:  number          // sempre ≥ 0; il significato dipende da kind/direction
  confidence:   Confidence
  severity?:    EventSeverity
  suggestion?:  string          // azione consigliata (una riga)
  href?:        string          // deep-link a una pagina dell'app
  meta?:        Record<string, unknown>
}

/** Un punto della proiezione giornaliera di cassa. */
export interface CashProjectionPoint {
  date:         string          // ISO YYYY-MM-DD
  balanceMinor: number          // saldo liquido proiettato a fine giornata
  inMinor:      number          // entrate discrete del giorno
  outMinor:     number          // uscite discrete del giorno
  /** Etichette degli eventi lumpy del giorno (per il tooltip del grafico). */
  events:       { label: string; amountMinor: number; direction: FlowDirection }[]
}

export interface ScadenziarioSummary {
  horizonDays:      number
  cashStartMinor:   number
  outflowMinor:     number      // totale uscite cash nell'orizzonte
  inflowMinor:      number      // totale entrate cash nell'orizzonte
  minBalanceMinor:  number      // punto di minimo della proiezione
  minBalanceDate:   string
  thresholdMinor:   number      // soglia di allerta (≈ 1 mese di spese)
  status:           'OK' | 'WARNING' | 'CRITICAL_SHORTAGE'
}

/** Il pacchetto completo consumato dalla pagina scadenziario. */
export interface ScadenziarioBundle {
  events:     DeadlineEvent[]
  insights:   Insight[]
  projection: CashProjectionPoint[]
  summary:    ScadenziarioSummary
}
