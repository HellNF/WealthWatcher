import { redirect } from 'next/navigation'
import { AuthError } from 'next-auth'
import { signIn } from '@/auth'
import { BrandMark } from '@/components/ui'

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
      // AuthError = accesso rifiutato dall'allowlist. Il redirect è un segnale di controllo
      // e deve essere rilanciato; non va catturato qui.
      if (e instanceof AuthError) redirect('/login?error=denied')
      throw e
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[--bg] px-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Brand */}
        <div className="flex flex-col items-center gap-3">
          <BrandMark size="lg" />
          <div className="text-center">
            <p className="text-base font-semibold text-[--ink]">WealthWatcher</p>
            <p className="text-sm text-[--muted]">Il tuo patrimonio, sotto controllo</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[--border] bg-[--surface] shadow-[--shadow] p-6 space-y-4">

          {error === 'denied' && (
            <div className="rounded-lg border border-[--danger]/30 bg-[--danger-subtle] px-3 py-2.5">
              <p className="text-sm text-[--danger]">
                Accesso negato: questa email non è in allowlist.
              </p>
            </div>
          )}

          <form action={googleSignIn}>
            <button
              type="submit"
              className="w-full h-10 rounded-lg border border-[--border] bg-[--surface-2] text-[--ink] text-sm font-medium hover:bg-[--surface] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--ring]"
            >
              Continua con Google
            </button>
          </form>

          {devLoginEnabled && (
            <form action={devSignIn} className="space-y-3 pt-3 border-t border-[--border]">
              <p className="text-xs text-[--warning] font-medium">Dev login — solo in locale</p>
              <input
                name="email"
                type="email"
                required
                placeholder="email in allowlist"
                className="w-full h-9 rounded-lg border border-[--border] bg-[--surface-2] px-3 text-sm text-[--ink] placeholder:text-[--faint] focus:outline-none focus:ring-2 focus:ring-[--ring] focus:border-[--brand] transition-colors duration-150"
              />
              <button
                type="submit"
                className="w-full h-9 rounded-lg bg-[--brand] text-[--brand-fg] text-sm font-medium hover:bg-[--brand-hover] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--ring]"
              >
                Entra (dev)
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-[--faint]">
          Accesso riservato agli utenti autorizzati.
        </p>
      </div>
    </div>
  )
}
