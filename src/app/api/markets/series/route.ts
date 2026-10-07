// src/app/api/markets/series/route.ts — Serie storiche per i grafici della
// pagina Mercati, scaricate dalla fonte su richiesta (vedi
// src/lib/marketOverview/series.ts). Dati pubblici di mercato, ma l'endpoint
// fa da tramite verso fonti esterne: richiede comunque una sessione valida.
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/dal'
import { getSeriesGroup, isSeriesGroup } from '@/lib/marketOverview/series'

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSession())?.user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const group = request.nextUrl.searchParams.get('group') ?? ''
  if (!isSeriesGroup(group)) return NextResponse.json({ error: 'Gruppo non valido' }, { status: 400 })

  const series = await getSeriesGroup(group)
  if (!series) return NextResponse.json({ error: 'Fonte non raggiungibile' }, { status: 502 })
  return NextResponse.json({ series }, { headers: { 'Cache-Control': 'private, max-age=3600' } })
}
