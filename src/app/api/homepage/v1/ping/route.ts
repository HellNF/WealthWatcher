// src/app/api/homepage/v1/ping/route.ts — Endpoint pubblico per il
// `siteMonitor` di Homepage (gethomepage.dev): il pallino di stato del
// servizio. Nessun dato utente, nessuna auth — rivela solo che l'app è su,
// come farebbe un siteMonitor puntato su /login.
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    { status: 'ok', app: 'WealthWatcher', version: '0.1.0' },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
