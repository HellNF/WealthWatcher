// src/app/api/homepage/v1/cashflow/route.ts — Entrate/uscite/risparmio del mese
// corrente, budget e runway (display: block).
import type { NextRequest } from 'next/server'
import { requireApiUser } from '@/lib/api/requireApiUser'
import { jsonNoStore } from '@/lib/api/respond'
import { buildCashflow } from '@/lib/homepage/payload'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireApiUser(req)
  if (!auth.ok) return auth.response

  const data = await buildCashflow(auth.userId)
  return jsonNoStore(data)
}
