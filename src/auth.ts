// src/auth.ts
import NextAuth, { type NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { isEmailAllowed, getAllowedRole, upsertUser, normalizeEmail } from '@/lib/users'
import { checkRateLimit } from '@/lib/rateLimit'

// Login passwordless (AUTH_DEV_LOGIN): senza limite di frequenza chiunque
// potrebbe tentare email diverse a raffica per scovarne una in allowlist.
const LOGIN_ATTEMPT_LIMIT    = 5
const LOGIN_ATTEMPT_WINDOW_MS = 5 * 60_000

// Login via email (senza password): l'accesso è gated dalla whitelist, ma
// l'unico "segreto" è conoscere un'email che vi compare — nessuna prova di
// possesso. Va bene per lo sviluppo locale, NON per un deploy raggiungibile
// da chi non è fidato: per questo è dietro AUTH_DEV_LOGIN e va lasciato
// disattivato ('false'/assente) ogni volta che l'istanza è esposta oltre la
// rete fidata (VPN inclusa, a maggior ragione se un giorno finisse su
// Internet). In produzione l'unico modo di entrare è Google OAuth, che
// dimostra il possesso dell'account.
export const isDevLoginEnabled = process.env.AUTH_DEV_LOGIN === 'true'

const providers: NextAuthConfig['providers'] = [Google]

if (isDevLoginEnabled) {
  providers.push(
    Credentials({
      id: 'credentials',
      name: 'Email',
      credentials: { email: { label: 'Email', type: 'email' } },
      authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email : ''
        if (!email) return null

        // Rate limit per email tentata — non distinguiamo "email non in
        // allowlist" da "troppi tentativi" nella risposta (in entrambi i casi
        // torna null), per non dare a un attaccante un segnale su quali email
        // esistono in allowlist.
        const { allowed } = checkRateLimit(`login:${normalizeEmail(email)}`, LOGIN_ATTEMPT_LIMIT, LOGIN_ATTEMPT_WINDOW_MS)
        if (!allowed || !isEmailAllowed(email)) return null

        const user = upsertUser({ email, name: email.split('@')[0] })
        if (!user) return null
        return { id: String(user.id), email: user.email, name: user.name ?? undefined }
      },
    }),
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Self-hosted behind a reverse proxy / VPN.
  trustHost: true,
  session: {
    strategy: 'jwt',
    // Default NextAuth è 30 giorni: un utente rimosso dall'allowlist (o
    // declassato) resterebbe autenticato con i vecchi permessi fino alla
    // scadenza del token. 7 giorni riduce quella finestra; il re-check ad
    // ogni richiesta qui sotto la chiude comunque quasi subito.
    maxAge: 7 * 24 * 60 * 60,
  },
  pages: { signIn: '/login' },
  providers,
  callbacks: {
    // Authorization gate — runs for every provider before a session is issued.
    signIn({ user, account, profile }) {
      if (!user.email || !isEmailAllowed(user.email)) return false

      // La fusione degli account (§ upsertUser) si fida ciecamente dell'email
      // restituita dal provider per decidere a quale utente collegare il
      // login: se Google la segnala come non verificata, non è un'identità
      // su cui appoggiare quella fusione — meglio rifiutare il login che
      // rischiare di agganciare la sessione all'utente sbagliato.
      if (account?.provider === 'google' && profile?.email_verified === false) {
        return false
      }

      return true
    },
    // Al login (user presente): rispecchia l'utente nella nostra tabella e
    // timbra id + ruolo sul token. Alle richieste successive (user assente,
    // solo refresh/lettura del token): ri-verifica l'allowlist ad ogni
    // chiamata — costa una SELECT indicizzata su SQLite locale, trascurabile
    // per la scala di quest'app — così un utente rimosso dall'allowlist o
    // declassato perde l'accesso/il ruolo aggiornato immediatamente, non solo
    // al prossimo login.
    jwt({ token, user }) {
      if (user?.email) {
        const dbUser = upsertUser({ email: user.email, name: user.name, image: user.image })
        if (dbUser) {
          token.uid = dbUser.id
          token.role = dbUser.role
          token.email = normalizeEmail(dbUser.email)
        }
        return token
      }

      if (typeof token.email === 'string') {
        const role = getAllowedRole(token.email)
        if (role === null) return {} // email non più in allowlist: token azzerato → sessione invalidata
        token.role = role
      }

      return token
    },
    session({ session, token }) {
      if (token.uid != null) {
        session.uid = token.uid
        session.role = token.role ?? 'member'
      }
      return session
    },
  },
})
