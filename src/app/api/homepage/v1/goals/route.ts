// src/app/api/homepage/v1/goals/route.ts — Obiettivi finanziari / buste (display: dynamic-list).
import type { NextRequest } from 'next/server'
import { requireApiUser } from '@/lib/api/requireApiUser'
import { jsonNoStore } from '@/lib/api/respond'
import { buildGoals } from '@/lib/homepage/payload'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireApiUser(req)
  if (!auth.ok) return auth.response

  const data = await buildGoals(auth.userId)
  return jsonNoStore(data)
}
