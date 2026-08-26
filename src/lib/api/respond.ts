// src/lib/api/respond.ts — Helper di risposta per le route M2M sotto /api/homepage.
import { NextResponse } from 'next/server'

/**
 * NextResponse.json con header che impediscono a un reverse proxy/CDN
 * intermedio di cachare dati finanziari personali, e che tengono la route
 * fuori dagli indici (non che dovrebbe mai finirci, ma costa nulla).
 */
export function jsonNoStore(body: unknown, init?: ResponseInit): NextResponse {
  const res = NextResponse.json(body, init)
  res.headers.set('Cache-Control', 'no-store, private')
  res.headers.set('X-Robots-Tag', 'noindex')
  return res
}
