// src/app/api/banking/callback/route.ts — Redirect target configurato come
// `redirect_url` presso Enable Banking. La banca reindirizza qui il browser
// dell'utente dopo il consenso PSU con `?code=...&state=...` (o `?error=...`
// se l'utente ha annullato). Scambia il code per una sessione, attiva la
// connessione e collega i conti autorizzati ai bank_accounts.
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/dal'
import { createSession } from '@/lib/banking/client'
import { getEnableBankingKey } from '@/lib/userSettings'
import {
  activateConnection,
  getConnectionByStateForUser,
  linkOrCreateAccount,
} from '@/lib/banking/connections'

function institutionUrl(req: NextRequest, institutionId: number): URL {
  return new URL(`/dashboard/institutions/${institutionId}`, req.url)
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireUser>>
  try {
    user = await requireUser()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const state = searchParams.get('state')
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  if (!state) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Verifica anti-CSRF: lo `state` deve corrispondere a una connessione
  // 'pending' creata da QUESTO utente (startConnectAction). Se non trovata,
  // il redirect non è riconducibile a un flusso che abbiamo avviato.
  const connection = getConnectionByStateForUser(user.id, state)
  if (!connection) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  const backUrl = institutionUrl(req, connection.institution_id)

  // L'utente ha annullato il consenso lato banca, oppure l'ASPSP ha rifiutato.
  if (error || !code) {
    return NextResponse.redirect(new URL(`${backUrl.pathname}?bankingError=1`, req.url))
  }

  // Le credenziali potrebbero essere state rimosse dall'utente dopo aver
  // avviato il flusso (finestra breve, ma va gestita esplicitamente).
  const creds = getEnableBankingKey(user.id)
  if (!creds) {
    return NextResponse.redirect(new URL(`${backUrl.pathname}?bankingError=1`, req.url))
  }

  const session = await createSession(creds, code)
  if (!session) {
    return NextResponse.redirect(new URL(`${backUrl.pathname}?bankingError=1`, req.url))
  }

  activateConnection(connection.id, session.session_id)

  for (const account of session.accounts) {
    linkOrCreateAccount(
      user.id,
      connection.institution_id,
      connection.id,
      account.uid,
      account.name ?? account.iban ?? `Conto ${account.uid.slice(0, 8)}`,
      account.currency ?? 'EUR',
    )
  }

  return NextResponse.redirect(backUrl)
}
