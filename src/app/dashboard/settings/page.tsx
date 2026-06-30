import Link from 'next/link'
import { requireUser } from '@/lib/dal'
import { hasOpenAiKey, getOpenAiKeySetAt } from '@/lib/userSettings'
import OpenAiKeyForm from './OpenAiKeyForm'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await requireUser()
  const hasKey = hasOpenAiKey(user.id)
  const setAt  = getOpenAiKeySetAt(user.id)

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-emerald-500 flex items-center justify-center text-sm font-bold text-zinc-950">
            W
          </div>
          <Link href="/dashboard" className="font-semibold text-zinc-100 hover:text-emerald-400 transition">
            WealthWatcher
          </Link>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400 text-sm">Impostazioni</span>
          <div className="ml-auto">
            <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-200 transition">
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 space-y-8">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Chiave API OpenAI</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Necessaria per importare i dati dai documenti KID (PDF). Ottienila da{' '}
              <span className="text-zinc-300">platform.openai.com/api-keys</span>.
            </p>
          </div>
          <OpenAiKeyForm hasKey={hasKey} setAt={setAt} />
        </section>
      </main>
    </div>
  )
}
