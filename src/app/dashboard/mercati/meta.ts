// src/app/dashboard/mercati/meta.ts — Etichette, colori e stili di presentazione
// per la pagina "Panorama Mercati". Nessuna logica: solo mappe UI.
import type { Cluster } from '@/lib/marketOverview/allocation'
import type { SignalLevel } from '@/lib/marketOverview/signals'
import type { Stance, Confidence } from '@/lib/marketOverview/analysis/types'
import type { ExposureClass } from '@/lib/marketOverview/lookthrough'
import type { BadgeVariant } from '@/components/ui'

export const CLUSTER_LABEL: Record<Cluster, string> = {
  stock:  'Azioni',
  etf:    'ETF',
  bond:   'Obbligazioni',
  crypto: 'Criptovalute',
  other:  'Altro',
}

// Colori barra composizione (coerenti con la palette categorie del seed).
export const CLUSTER_COLOR: Record<Cluster, string> = {
  stock:  '#6366f1',
  etf:    '#3b82f6',
  bond:   '#06b6d4',
  crypto: '#f59e0b',
  other:  '#6b7280',
}

// Livello neutro → variante badge. Volutamente non semaforico "buono/cattivo":
// high = evidenza (warning ambra), low = evidenza (info blu), normal = neutro.
export const LEVEL_BADGE: Record<SignalLevel, BadgeVariant> = {
  high:   'warning',
  low:    'info',
  normal: 'neutral',
}

// ── Stance di settore ─────────────────────────────────────────────────────────
// Scala didirezionale a 5 livelli. Colori: scala divergente verde↔ambra con
// grigio neutro al centro. NON semaforo "giusto/sbagliato": descrive il contesto.
export const STANCE_ORDER: Stance[] = ['caution', 'lean-caution', 'neutral', 'lean-accumulate', 'accumulate']

export const STANCE_META: Record<Stance, { label: string; color: string; badge: BadgeVariant }> = {
  accumulate:        { label: 'Favorevole',              color: '#22c55e', badge: 'gain' },
  'lean-accumulate': { label: 'Moderatamente favorevole', color: '#84cc16', badge: 'success' },
  neutral:           { label: 'Neutro',                  color: '#9ca3af', badge: 'neutral' },
  'lean-caution':    { label: 'Cautela moderata',        color: '#f59e0b', badge: 'warning' },
  caution:           { label: 'Teso',                    color: '#ef4444', badge: 'danger' },
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  alta:  'confidenza alta',
  media: 'confidenza media',
  bassa: 'confidenza bassa',
}

export const READING_STYLE: Record<'favorable' | 'neutral' | 'unfavorable', { dot: string; label: string }> = {
  favorable:   { dot: '#22c55e', label: 'A favore' },
  neutral:     { dot: '#9ca3af', label: 'Neutro' },
  unfavorable: { dot: '#f59e0b', label: 'Cautela' },
}

// Cosa vuol dire, in parole semplici, ciascun livello della scala. Sempre al
// passato ("storicamente"): è una frequenza osservata, non una previsione.
export const STANCE_MEANING: Record<Stance, string> = {
  accumulate:        'Storicamente, condizioni come queste sono state tra le più favorevoli per chi iniziava a investire.',
  'lean-accumulate': 'Condizioni un po’ migliori della media storica per chi entra oggi.',
  neutral:           'Né caro né a sconto rispetto alla sua storia: nessun segnale forte in un senso o nell’altro.',
  'lean-caution':    'Prezzi piuttosto tirati rispetto alla storia: in passato chi è entrato a questi livelli ha avuto risultati più modesti della media.',
  caution:           'Storicamente tra le condizioni meno favorevoli per iniziare: prezzi alti e poco margine in caso di sorprese negative.',
}

// Tono dei temi macro → variante badge.
export const TONE_BADGE: Record<'calm' | 'watch' | 'alert', BadgeVariant> = {
  calm:  'neutral',
  watch: 'warning',
  alert: 'danger',
}

// ── Esposizione effettiva (guardando dentro i fondi) ──────────────────────────
export const EXPOSURE_LABEL: Record<ExposureClass, string> = {
  equity:  'Azioni',
  bond:    'Obbligazioni',
  crypto:  'Criptovalute',
  cash:    'Liquidità',
  other:   'Altro',
  unknown: 'Fondi senza dettaglio',
}

export const EXPOSURE_COLOR: Record<ExposureClass, string> = {
  equity:  '#6366f1',
  bond:    '#06b6d4',
  crypto:  '#f59e0b',
  cash:    '#10b981',
  other:   '#6b7280',
  unknown: '#d1d5db',
}

// Settori come li nomina Yahoo (dati Morningstar) → italiano.
export const SECTOR_LABEL: Record<string, string> = {
  technology:             'Tecnologia',
  financial_services:     'Finanza',
  healthcare:             'Salute',
  consumer_cyclical:      'Consumi non essenziali',
  consumer_defensive:     'Beni di prima necessità',
  industrials:            'Industria',
  communication_services: 'Comunicazione e media',
  energy:                 'Energia',
  basic_materials:        'Materiali di base',
  utilities:              'Servizi di pubblica utilità',
  realestate:             'Immobiliare',
}
