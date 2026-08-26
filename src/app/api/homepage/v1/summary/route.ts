// src/app/api/homepage/v1/summary/route.ts — Widget principale (display: block):
// patrimonio netto, investito, incremento, P&L, rischio, fisco.
import type { NextRequest } from 'next/server'
import { requireApiUser } from '@/lib/api/requireApiUser'
import { jsonNoStore } from '@/lib/api/respond'
import { buildSummary } from '@/lib/homepage/payload'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireApiUser(req)
  if (!auth.ok) return auth.response

  const data = await buildSummary(auth.userId)
  return jsonNoStore(data)
}
