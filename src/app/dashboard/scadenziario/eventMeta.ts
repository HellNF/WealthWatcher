// src/app/dashboard/scadenziario/eventMeta.ts — Mapping presentazionale degli eventi.
//
// Un'unica fonte di verità per etichette, colori, icone e badge di ogni fonte
// evento, così agenda, calendario e dettaglio giorno restano coerenti.
import {
  Stamp, Landmark, PiggyBank, Home, Repeat, CalendarPlus,
  TrendingUp, Wallet, Percent, Target, Link2, Scissors, Bitcoin,
  type LucideIcon,
} from 'lucide-react'
import type { BadgeVariant } from '@/components/ui/Badge'
import type { DeadlineSource } from '@/lib/calendar'

export interface SourceMeta {
  label: string
  dot:   string          // colore CSS del pallino
  icon:  LucideIcon
  badge: BadgeVariant
}

export const SOURCE_META: Record<DeadlineSource, SourceMeta> = {
  bollo:            { label: 'Bollo',        dot: 'var(--muted)',   icon: Stamp,        badge: 'neutral' },
  ivafe:            { label: 'IVAFE',        dot: 'var(--muted)',   icon: Landmark,     badge: 'neutral' },
  credito_fiscale:  { label: 'Credito',      dot: 'var(--warning)', icon: PiggyBank,    badge: 'warning' },
  rata_mutuo:       { label: 'Mutuo',        dot: 'var(--info)',    icon: Home,         badge: 'info' },
  ricorrente:       { label: 'Ricorrente',   dot: 'var(--danger)',  icon: Repeat,       badge: 'neutral' },
  custom:           { label: 'Personale',    dot: 'var(--brand)',   icon: CalendarPlus, badge: 'success' },
  dividendo_atteso: { label: 'Dividendo',    dot: 'var(--brand)',   icon: TrendingUp,   badge: 'gain' },
  stipendio_atteso: { label: 'Stipendio',    dot: 'var(--brand)',   icon: Wallet,       badge: 'gain' },
  interessi_conto:  { label: 'Interessi',    dot: 'var(--brand)',   icon: Percent,      badge: 'gain' },
  obiettivo:        { label: 'Obiettivo',    dot: 'var(--info)',    icon: Target,       badge: 'info' },
  consenso_banca:   { label: 'Open Banking', dot: 'var(--warning)', icon: Link2,        badge: 'warning' },
  harvesting:       { label: 'Harvesting',   dot: 'var(--warning)', icon: Scissors,     badge: 'warning' },
  franchigia_crypto:{ label: 'Crypto',       dot: 'var(--warning)', icon: Bitcoin,      badge: 'warning' },
}

export function metaFor(source: DeadlineSource): SourceMeta {
  return SOURCE_META[source] ?? SOURCE_META.custom
}

// ── Formattazione ────────────────────────────────────────────────────────────

export function fmtEur(minor: number, maximumFractionDigits = 0): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency', currency: 'EUR', maximumFractionDigits,
  })
}

const MONTHS_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]
const MONTHS_SHORT = [
  'gen', 'feb', 'mar', 'apr', 'mag', 'giu',
  'lug', 'ago', 'set', 'ott', 'nov', 'dic',
]
const DAYS_FULL = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']

export { MONTHS_IT }

export function fmtShort(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${parseInt(d, 10)} ${MONTHS_SHORT[parseInt(m, 10) - 1]}`
}

export function fmtFull(iso: string): string {
  const dt = new Date(`${iso}T00:00:00`)
  return `${DAYS_FULL[dt.getDay()]} ${dt.getDate()} ${MONTHS_IT[dt.getMonth()].toLowerCase()} ${dt.getFullYear()}`
}

export function daysUntil(iso: string, today: string): number {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
}

/** Etichetta countdown umana: "Oggi", "Domani", "tra 5 giorni", "12 giorni fa". */
export function countdownLabel(iso: string, today: string): string {
  const d = daysUntil(iso, today)
  if (d === 0) return 'Oggi'
  if (d === 1) return 'Domani'
  if (d === -1) return 'Ieri'
  if (d < 0) return `${-d} giorni fa`
  return `tra ${d} giorni`
}
