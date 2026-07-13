// src/lib/formatDate.ts
//
// Formattazione date/ore in timezone fisso (Europe/Rome — l'unico rilevante
// per un'app pensata per utenti italiani, locale 'it-IT' ovunque). Senza un
// timeZone esplicito, Date.toLocale*String() usa il fuso del PROCESSO che
// esegue il codice: nei Client Component questo causa un hydration mismatch
// (il server, spesso un container Docker in UTC, produce un orario diverso
// da quello che il browser dell'utente calcola all'hydration — "Minified
// React error #418"); nei Server Component non causa crash ma mostra
// silenziosamente la data "sbagliata" vicino alla mezzanotte se il server
// non gira in Europe/Rome. Pinnare il timezone qui elimina entrambi i
// problemi, indipendentemente da dove/come è deployato il processo Node.
export function formatDateIt(epochSeconds: number, options: Intl.DateTimeFormatOptions = {}): string {
  return new Date(epochSeconds * 1000).toLocaleDateString('it-IT', { ...options, timeZone: 'Europe/Rome' })
}

export function formatTimeIt(epochSeconds: number, options: Intl.DateTimeFormatOptions = {}): string {
  return new Date(epochSeconds * 1000).toLocaleTimeString('it-IT', { ...options, timeZone: 'Europe/Rome' })
}

export function formatDateTimeIt(epochSeconds: number, options: Intl.DateTimeFormatOptions = {}): string {
  return new Date(epochSeconds * 1000).toLocaleString('it-IT', { ...options, timeZone: 'Europe/Rome' })
}
