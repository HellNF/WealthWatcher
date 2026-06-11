import { getMessages } from '@/lib/messages'
import { readSpec } from '@/lib/spec'
import SpecViewer from '@/components/SpecViewer'
import SpecSidebar from '@/components/SpecSidebar'
import ChatSection from '@/components/ChatSection'

export const dynamic = 'force-dynamic'

export default function Home() {
  const messages = getMessages()
  const { headings } = readSpec()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-emerald-500 flex items-center justify-center text-sm font-bold text-zinc-950">
            W
          </div>
          <span className="font-semibold text-zinc-100">WealthWatcher</span>
          <span className="text-zinc-600 text-sm">— Specifiche v0.1</span>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 flex flex-col lg:flex-row gap-8">
        {/* Spec + Sidebar */}
        <div className="flex-1 flex gap-8 min-w-0">
          <main className="flex-1 min-w-0">
            <SpecViewer />
          </main>
          <aside className="hidden xl:block w-56 shrink-0">
            <SpecSidebar headings={headings} />
          </aside>
        </div>

        {/* Chat panel */}
        <div className="lg:w-96 shrink-0">
          <div className="sticky top-20 flex flex-col h-[calc(100vh-6rem)] rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium text-zinc-200">Discussione & Proposte</span>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col">
              <ChatSection initialMessages={messages} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
