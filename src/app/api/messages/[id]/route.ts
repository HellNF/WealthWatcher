import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/dal'
import { resolveMessage, deleteMessage } from '@/lib/messages'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await getSession()
  if (session?.role !== 'admin') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'ID non valido' }, { status: 400 })

  const body = await req.json() as { resolved: boolean }
  resolveMessage(id, body.resolved)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const session = await getSession()
  if (session?.role !== 'admin') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'ID non valido' }, { status: 400 })

  deleteMessage(id)
  return NextResponse.json({ ok: true })
}
