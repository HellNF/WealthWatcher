// src/app/dashboard/mercati/format.ts — Formattazione numerica condivisa dai
// componenti della pagina Mercati (locale italiano, segno esplicito sui rendimenti).

export function fmtNum(n: number, decimals = 1): string {
  return n.toLocaleString('it-IT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

/** Percentuale con segno: "+12,3%", "−4,0%", "0,0%". "–" se il dato manca. */
export function fmtSignedPct(n: number | null, decimals = 1): string {
  if (n === null || !Number.isFinite(n)) return '–'
  const abs = fmtNum(Math.abs(n), decimals)
  if (Number(abs.replace(',', '.')) === 0) return `${abs}%`
  return `${n > 0 ? '+' : '−'}${abs}%`
}

/** Classe colore per un rendimento: guadagno, perdita o neutro. */
export function toneClass(n: number | null): string {
  if (n === null || !Number.isFinite(n) || Math.abs(n) < 0.05) return 'text-(--muted)'
  return n > 0 ? 'text-(--brand-text)' : 'text-(--danger-text)'
}

/** 'YYYY-MM-DD' → '6 ott 2026'. */
export function fmtIsoDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function fmtEpochDate(epoch: number, long = false): string {
  return new Date(epoch * 1000).toLocaleDateString('it-IT', { day: 'numeric', month: long ? 'long' : 'short', year: 'numeric' })
}
