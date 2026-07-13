// src/lib/fetchWithTimeout.ts
//
// Nessuna fetch verso servizi esterni (prezzi, Open Banking, scraping
// AutoScout24) aveva un timeout: un endpoint che resta appeso blocca la
// richiesta che lo invoca (render di una Server Component, Server Action)
// fino al timeout TCP del sistema operativo — spesso minuti, non secondi.
// Questo wrapper applica un timeout esplicito via AbortSignal a ogni
// integrazione esterna, senza cambiare le altre opzioni di fetch (next.js
// `cache`/`next.revalidate` restano intatte).
const DEFAULT_TIMEOUT_MS = 10_000

export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  // Se il chiamante ha già passato un signal proprio, lo componiamo invece di
  // sovrascriverlo (nessun caso d'uso attuale lo fa, ma resta corretto se un
  // domani serve annullamento esterno oltre al timeout).
  const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal
  return fetch(input, { ...init, signal })
}
