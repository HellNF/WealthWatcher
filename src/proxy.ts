// src/proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Optimistic auth gate (SPEC §2 / Next.js auth guide): a cheap cookie-presence
// check that redirects clearly-unauthenticated users away from the app. It is
// NOT the security boundary — every page/action re-checks via the DAL. We avoid
// importing the DB or full auth config here on purpose (proxy stays lightweight).
const SESSION_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token']

const isDev = process.env.NODE_ENV === 'development'

// FORCE_HTTPS_UPGRADE: 'upgrade-insecure-requests' fa sì che il browser
// richieda TUTTE le risorse (JS/CSS/font) via HTTPS sullo stesso host — se
// l'istanza è servita in HTTP puro (es. dietro VPN senza TLS terminato),
// quella direttiva rompe l'intera pagina (nessun listener TLS sull'host →
// ERR_SSL_UNRECOGNIZED_NAME_ALERT su ogni asset). Va abilitata SOLO quando
// l'istanza è davvero raggiunta via HTTPS end-to-end.
const forceHttpsUpgrade = process.env.FORCE_HTTPS_UPGRADE === 'true'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/dashboard')) {
    const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name))
    if (!hasSession) {
      const url = new URL('/login', request.url)
      url.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(url)
    }
  }

  // Nonce fresco per richiesta — vedi src/lib/security/csp.ts per il perché
  // di nonce-based invece di hash-based.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''};
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: https:;
    font-src 'self';
    connect-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    ${forceHttpsUpgrade ? 'upgrade-insecure-requests;' : ''}
  `
    .replace(/\s{2,}/g, ' ')
    .trim()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', cspHeader)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', cspHeader)
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
