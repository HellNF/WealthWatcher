// src/app/dashboard/tasse/format.ts — Helper di formattazione condivisi dalla pagina Tasse.
// (gli importi usano fmtEur di @/lib/format).

/** Aliquota (0.26 → "26%"), 1–2 decimali. */
export function fmtPct(rate: number): string {
  return (rate * 100).toLocaleString('it-IT', {
    minimumFractionDigits: 1, maximumFractionDigits: 2,
  }) + '%'
}

/** Segno esplicito "+" per i numeri non negativi (il "−" arriva dal numero stesso). */
export function sign(n: number): string { return n >= 0 ? '+' : '' }
