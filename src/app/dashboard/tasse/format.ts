// src/app/dashboard/tasse/format.ts — Helper di formattazione condivisi dalla pagina Tasse.
// Centralizzati per evitare duplicazioni tra page.tsx e i componenti sezione.

/** Euro senza decimali (importi di sintesi). */
export function fmtEur(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  })
}

/** Euro con 2 decimali (importi puntuali/legali). */
export function fmtEurDec(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

/** Alias esplicito per gli importi di bollo/IVAFE (sempre 2 decimali). */
export const fmtBollo = fmtEurDec

/** Aliquota (0.26 → "26%"), 1–2 decimali. */
export function fmtPct(rate: number): string {
  return (rate * 100).toLocaleString('it-IT', {
    minimumFractionDigits: 1, maximumFractionDigits: 2,
  }) + '%'
}

/** Segno esplicito "+" per i numeri non negativi (il "−" arriva dal numero stesso). */
export function sign(n: number): string { return n >= 0 ? '+' : '' }
