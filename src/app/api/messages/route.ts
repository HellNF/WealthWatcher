// src/app/api/messages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getMessages, insertMessage } from '@/lib/messages'

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
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 })
  }

  const { author, content } = body as Record<string, unknown>

  if (!author || typeof author !== 'string' || author.trim().length === 0) {
    return NextResponse.json({ error: 'Author obbligatorio' }, { status: 400 })
  }
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'Content obbligatorio' }, { status: 400 })
  }
  if (author.length > 50) {
    return NextResponse.json({ error: 'Author troppo lungo (max 50)' }, { status: 400 })
  }
  if (content.length > 1000) {
    return NextResponse.json({ error: 'Content troppo lungo (max 1000)' }, { status: 400 })
  }

  const message = insertMessage(author.trim(), content.trim())
  return NextResponse.json(message, { status: 201 })
}
