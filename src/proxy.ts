// src/proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Optimistic auth gate (SPEC §2 / Next.js auth guide): a cheap cookie-presence
// check that redirects clearly-unauthenticated users away from the app. It is
// NOT the security boundary — every page/action re-checks via the DAL. We avoid
// importing the DB or full auth config here on purpose (proxy stays lightweight).
const SESSION_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token']

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name))
  if (hasSession) return NextResponse.next()

  const url = new URL('/login', request.url)
  url.searchParams.set('callbackUrl', request.nextUrl.pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
