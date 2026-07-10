// src/components/PublicPageShell.tsx — Layout condiviso per le pagine
// pubbliche informative (privacy, termini): stessa identità visiva della
// landing page (src/app/page.tsx: bg-zinc-950, logo WatcherMark, footer),
// senza duplicare nav/footer in ogni pagina.
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { WatcherMark } from '@/components/ui/WatcherMark'

export default function PublicPageShell({
  title,
  updated,
  children,
}: {
  title:   string
  updated: string   // es. "10 luglio 2026"
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-300 font-sans">
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group hover:opacity-80 transition-opacity">
            <WatcherMark size="md" className="text-emerald-400" />
            <span className="font-semibold text-white tracking-tight">WealthWatcher</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="size-3.5" /> Torna al sito
          </Link>
        </div>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">{title}</h1>
        <p className="text-sm text-zinc-500 mb-10">Ultimo aggiornamento: {updated}</p>
        <div className="space-y-8">
          {children}
        </div>
      </main>

      <footer className="border-t border-zinc-800/60 px-6 py-8">
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-4 text-xs text-zinc-600">
          <span className="inline-flex items-center gap-2 font-mono">
            <WatcherMark size={14} className="text-zinc-600" />
            © 2026 WealthWatcher
          </span>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy</Link>
            <Link href="/terms"   className="hover:text-zinc-300 transition-colors">Termini</Link>
            <Link href="/"        className="hover:text-zinc-300 transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ── Elementi tipografici condivisi (coerenti con lo stile della landing) ────

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="space-y-3 text-sm text-zinc-400 leading-relaxed [&_strong]:text-zinc-200 [&_a]:text-emerald-400 [&_a:hover]:underline">
        {children}
      </div>
    </section>
  )
}

export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc list-outside pl-5 space-y-1.5">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )
}
