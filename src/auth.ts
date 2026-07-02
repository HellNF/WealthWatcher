// src/auth.ts
import NextAuth, { type NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { isEmailAllowed, upsertUser, normalizeEmail } from '@/lib/users'

// Login via email (senza password): l'accesso è già gated dalla whitelist.
// Sempre attivo — provider legittimo per un'app self-hosted.
const providers: NextAuthConfig['providers'] = [
  Google,
  Credentials({
    id: 'email',
    name: 'Email',
    credentials: { email: { label: 'Email', type: 'email' } },
    authorize(credentials) {
      const email = typeof credentials?.email === 'string' ? credentials.email : ''
      if (!email || !isEmailAllowed(email)) return null
      const user = upsertUser({ email, name: email.split('@')[0] })
      if (!user) return null
      return { id: String(user.id), email: user.email, name: user.name ?? undefined }
    },
  }),
]

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Self-hosted behind a reverse proxy / VPN.
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers,
  callbacks: {
    // Authorization gate — runs for every provider before a session is issued.
    signIn({ user }) {
      return !!user.email && isEmailAllowed(user.email)
    },
    // On sign-in, mirror the user into our own table and stamp id + role on the
    // token. Subsequent requests carry the token without touching the DB.
    jwt({ token, user }) {
      if (user?.email) {
        const dbUser = upsertUser({ email: user.email, name: user.name, image: user.image })
        if (dbUser) {
          token.uid = dbUser.id
          token.role = dbUser.role
          token.email = normalizeEmail(dbUser.email)
        }
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
