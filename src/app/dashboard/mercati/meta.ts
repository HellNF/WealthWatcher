// src/app/dashboard/mercati/meta.ts — Etichette, colori e stili di presentazione
// per la pagina "Panorama Mercati". Nessuna logica: solo mappe UI.
import type { Cluster } from '@/lib/marketOverview/allocation'
import type { SignalLevel } from '@/lib/marketOverview/signals'
import type { Stance, Confidence } from '@/lib/marketOverview/analysis/types'
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
