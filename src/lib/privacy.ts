// src/lib/privacy.ts
//
// Helper di masking/redazione per i punti in cui un dato sensibile potrebbe
// uscire dal confine "utente proprietario" — log, fallback UI, futuri export.
// Non alterano i dati memorizzati (servono interi per le funzionalità): sono
// pensati per l'OUTPUT, non per lo storage.

/**
 * Maschera un IBAN mostrando solo il codice paese e le ultime 4 cifre.
 * `IT60X0542811101000000123456` → `IT••••••••••••••••••••3456`.
 */
export function maskIban(iban: string): string {
  const clean = iban.replace(/\s+/g, '').toUpperCase()
  if (clean.length <= 6) return '•'.repeat(Math.max(clean.length, 4))
  const head = clean.slice(0, 2)
  const tail = clean.slice(-4)
  const maskedLength = clean.length - head.length - tail.length
  return `${head}${'•'.repeat(maskedLength)}${tail}`
}

/**
 * Maschera un indirizzo email mantenendo leggibile solo il primo carattere
 * della parte locale e il dominio. `mario.rossi@example.com` → `m••••••••@example.com`.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) return '•'.repeat(Math.max(email.length, 4))
  const local  = email.slice(0, at)
  const domain = email.slice(at) // include la '@'
  return `${local[0]}${'•'.repeat(Math.max(local.length - 1, 1))}${domain}`
}

/**
 * Tronca una descrizione/testo libero (es. causale bancaria) a una lunghezza
 * di anteprima sicura per i log — evita di riversare l'intero contenuto
 * (potenzialmente con nomi/causali sensibili) in output non protetti come i
 * log applicativi.
 */
export function redactDescription(text: string, maxLength = 12): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength)}…`
}
