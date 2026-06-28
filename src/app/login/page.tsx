// src/app/login/page.tsx
import { redirect } from 'next/navigation'
import { AuthError } from 'next-auth'
import { signIn } from '@/auth'

const devLoginEnabled =
  process.env.NODE_ENV !== 'production' && process.env.AUTH_DEV_LOGIN === 'true'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}) {
  const { callbackUrl, error } = await searchParams
  const redirectTo = callbackUrl && callbackUrl.startsWith('/') ? callbackUrl : '/dashboard'

  async function googleSignIn() {
    'use server'
    await signIn('google', { redirectTo })
  }

  async function devSignIn(formData: FormData) {
    'use server'
    try {
      await signIn('dev', { email: String(formData.get('email') ?? ''), redirectTo })
    } catch (e) {
      // AuthError = rejected by allowlist/authorize. Redirect propagates as a
      // thrown control-flow signal and must be re-thrown.
      if (e instanceof AuthError) redirect('/login?error=denied')
      throw e
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-emerald-500 flex items-center justify-center font-bold text-zinc-950">
            W
          </div>
          <div>
            <div className="font-semibold text-zinc-100">WealthWatcher</div>
            <div className="text-xs text-zinc-500">Accesso riservato</div>
          </div>
        </div>

        {error === 'denied' && (
          <p className="text-sm rounded-md bg-red-950/50 border border-red-900 text-red-300 px-3 py-2">
            Accesso negato: questa email non è in allowlist.
          </p>
        )}

        <form action={googleSignIn}>
          <button
            type="submit"
            className="w-full rounded-lg bg-zinc-100 text-zinc-900 font-medium py-2.5 hover:bg-white transition"
          >
            Continua con Google
          </button>
        </form>

        {devLoginEnabled && (
          <form action={devSignIn} className="space-y-3 pt-2 border-t border-zinc-800">
            <p className="text-xs text-amber-500/80 pt-3">Dev login (solo locale)</p>
            <input
              name="email"
              type="email"
              required
              placeholder="email in allowlist"
              className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 outline-none"
            />
            <button
              type="submit"
              className="w-full rounded-lg border border-emerald-700 text-emerald-400 font-medium py-2 hover:bg-emerald-950/40 transition"
            >
              Entra (dev)
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
