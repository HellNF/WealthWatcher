import { redirect } from 'next/navigation'
import { AuthError } from 'next-auth'
import { signIn } from '@/auth'
import { BrandMark } from '@/components/ui'

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

  async function emailSignIn(formData: FormData) {
    'use server'
    try {
      await signIn('credentials', { email: String(formData.get('email') ?? ''), redirectTo })
    } catch (e) {
      // AuthError = accesso rifiutato dalla whitelist.
      if (e instanceof AuthError) redirect('/login?error=denied')
      throw e
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[--bg] px-4 overflow-hidden">
      {/* glow ambientale, fisso e non interattivo */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] h-[28rem] rounded-full bg-[--brand]/[0.07] blur-[100px]" />
      </div>

      <div className="relative w-full max-w-sm space-y-6">

        {/* Brand */}
        <div className="flex flex-col items-center gap-3">
          <BrandMark size="lg" />
          <div className="text-center">
            <p className="text-base font-semibold text-[--ink]">WealthWatcher</p>
            <p className="text-sm text-[--muted]">Il tuo patrimonio, sotto controllo</p>
          </div>
        </div>

        {/* Card — doppio bordo per profondità "hardware" */}
        <div className="rounded-[1.75rem] bg-[--surface-2]/60 ring-1 ring-[--border] p-1.5">
        <div className="rounded-3xl border border-[--border] bg-[--surface] shadow-[var(--shadow-lg),var(--highlight)] p-6 space-y-4">

          {error === 'denied' && (
            <div className="rounded-lg border border-[--danger]/30 bg-[--danger-subtle] px-3 py-2.5">
              <p className="text-sm text-[--danger]">
                Accesso negato: questa email non è nella whitelist.
              </p>
            </div>
          )}

          {/* Email login (sempre disponibile) */}
          <form action={emailSignIn} className="space-y-3">
            <input
              name="email"
              type="email"
              required
              placeholder="La tua email"
              className="w-full h-10 rounded-lg border border-[--border] bg-[--surface-2] px-3 text-sm text-[--ink] placeholder:text-[--faint] focus:outline-none focus:ring-2 focus:ring-[--ring] focus:border-[--brand] transition-colors duration-150"
            />
            <button
              type="submit"
              className="w-full h-10 rounded-lg bg-[--brand] text-[--brand-fg] text-sm font-medium shadow-[var(--shadow-sm),inset_0_1px_0_0_oklch(1_0_0/0.25)] hover:bg-[--brand-hover] hover:-translate-y-px active:scale-[0.98] active:translate-y-0 transition-all duration-200 [transition-timing-function:var(--ease-spring)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--ring]"
            >
              Accedi
            </button>
          </form>

          <div className="relative flex items-center gap-3">
            <div className="flex-1 border-t border-[--border]" />
            <span className="text-xs text-[--faint]">oppure</span>
            <div className="flex-1 border-t border-[--border]" />
          </div>

          <form action={googleSignIn}>
            <button
              type="submit"
              className="w-full h-10 rounded-lg border border-[--border] bg-[--surface-2] text-[--ink] text-sm font-medium hover:bg-[--surface] hover:-translate-y-px active:scale-[0.98] active:translate-y-0 transition-all duration-200 [transition-timing-function:var(--ease-spring)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--ring]"
            >
              Continua con Google
            </button>
          </form>
        </div>
        </div>

        <p className="text-center text-xs text-[--faint]">
          Accesso riservato agli utenti in whitelist.
        </p>
      </div>
    </div>
  )
}
