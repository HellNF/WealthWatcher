// src/app/api/messages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getMessages, insertMessage } from '@/lib/messages'
import { requireUser } from '@/lib/dal'
import { checkRateLimit } from '@/lib/rateLimit'

const POST_LIMIT      = 20
const POST_WINDOW_MS  = 10 * 60_000

// Lettura pubblica (bacheco proposte/feedback sulla landing page — non
// contiene dati finanziari), ma la SCRITTURA richiede una sessione valida:
// l'autore è derivato dall'utente autenticato, non più preso a piacere dal
// client (evita spoofing dell'autore e post anonimi/spam illimitati).
export function GET(request: NextRequest): NextResponse {
  const sinceParam = request.nextUrl.searchParams.get('since')

  if (sinceParam !== null) {
    const since = parseInt(sinceParam, 10)
    if (isNaN(since)) {
      return NextResponse.json({ error: 'Parametro since non valido' }, { status: 400 })
    }
    return NextResponse.json(getMessages(since))
  }

  return NextResponse.json(getMessages())
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireUser>>
  try {
    user = await requireUser()
  } catch {
    return NextResponse.json({ error: 'Autenticazione richiesta' }, { status: 401 })
  }

  const { allowed, retryAfterMs } = checkRateLimit(`messages:${user.id}`, POST_LIMIT, POST_WINDOW_MS)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Troppi messaggi inviati, riprova più tardi' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 })
  }

  const { content } = body as Record<string, unknown>

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'Content obbligatorio' }, { status: 400 })
  }
  if (content.length > 1000) {
    return NextResponse.json({ error: 'Content troppo lungo (max 1000)' }, { status: 400 })
  }

  const author = (user.name?.trim() || user.email || `utente-${user.id}`).slice(0, 50)
  const message = insertMessage(author, content.trim())
  return NextResponse.json(message, { status: 201 })
}
