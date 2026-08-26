// src/app/api/homepage/v1/deadlines/route.ts — Scadenziario nei prossimi N
// giorni (display: dynamic-list). Query param opzionale: ?days=30 (default
// 30, clamp 1–365).
import type { NextRequest } from 'next/server'
import { requireApiUser } from '@/lib/api/requireApiUser'
import { jsonNoStore } from '@/lib/api/respond'
import { buildDeadlines } from '@/lib/homepage/payload'

export const dynamic = 'force-dynamic'

const DEFAULT_DAYS = 30
const MIN_DAYS = 1
const MAX_DAYS = 365

export async function GET(req: NextRequest) {
  const auth = await requireApiUser(req)
  if (!auth.ok) return auth.response

  const raw = req.nextUrl.searchParams.get('days')
  const parsed = raw !== null ? parseInt(raw, 10) : DEFAULT_DAYS
  const days = Number.isFinite(parsed)
    ? Math.min(MAX_DAYS, Math.max(MIN_DAYS, parsed))
    : DEFAULT_DAYS

  const data = await buildDeadlines(auth.userId, days)
  return jsonNoStore(data)
}
