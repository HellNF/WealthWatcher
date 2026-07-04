'use client'

import { useEffect, useRef, useState } from 'react'
import ChatBubble from './ChatBubble'
import type { Message } from '@/lib/messages'

interface Props {
  messages: Message[]
  ownAuthor: string | null
  isAdmin?: boolean
  onNewMessages: (msgs: Message[]) => void
  onResolve?: (id: number, resolved: boolean) => void
  onDelete?: (id: number) => void
}

export default function ChatFeed({
  messages,
  ownAuthor,
  isAdmin = false,
  onNewMessages,
  onResolve,
  onDelete,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [resolvedOpen, setResolvedOpen] = useState(false)

  const active   = messages.filter((m) => m.resolved === 0)
  const resolved = messages.filter((m) => m.resolved === 1)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [active.length])

  const onNewMessagesRef = useRef(onNewMessages)
  useEffect(() => { onNewMessagesRef.current = onNewMessages }, [onNewMessages])

  useEffect(() => {
    const poll = async () => {
      const last = messages[messages.length - 1]
      const since = last ? last.created_at : 0
      try {
        const res = await fetch(`/api/messages?since=${since}`)
        if (!res.ok) return
        const newMsgs: Message[] = await res.json()
        if (newMsgs.length > 0) onNewMessagesRef.current(newMsgs)
      } catch { /* silent fail */ }
    }
    const interval = setInterval(poll, 10_000)
    return () => clearInterval(interval)
  }, [messages])

  async function handleResolve(id: number, resolvedVal: boolean) {
    try {
      await fetch(`/api/messages/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resolved: resolvedVal }),
      })
      onResolve?.(id, resolvedVal)
    } catch { /* silent fail */ }
  }

  async function handleDelete(id: number) {
    try {
      await fetch(`/api/messages/${id}`, { method: 'DELETE' })
      onDelete?.(id)
    } catch { /* silent fail */ }
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-zinc-600 text-sm">
        Nessun messaggio ancora. Sii il primo a proporre qualcosa!
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {active.length === 0 && resolved.length > 0 && (
        <p className="text-center text-zinc-600 text-sm">Tutti i messaggi sono stati elaborati.</p>
      )}

      {active.map((msg) => (
        <ChatBubble
          key={msg.id}
          message={msg}
          isOwn={ownAuthor !== null && msg.author === ownAuthor}
          isAdmin={isAdmin}
          onResolve={(r) => handleResolve(msg.id, r)}
          onDelete={() => handleDelete(msg.id)}
        />
      ))}

      <div ref={bottomRef} />

      {/* Sezione collassabile messaggi completati */}
      {resolved.length > 0 && (
        <div className="mt-2 border-t border-zinc-800 pt-3">
          <button
            onClick={() => setResolvedOpen((o) => !o)}
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors w-full"
          >
            <span className="flex-1 text-left font-medium">
              Completati ({resolved.length})
            </span>
            <span>{resolvedOpen ? '▲' : '▼'}</span>
          </button>

          {resolvedOpen && (
            <div className="flex flex-col gap-3 mt-3">
              {resolved.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  isOwn={ownAuthor !== null && msg.author === ownAuthor}
                  isAdmin={isAdmin}
                  onResolve={(r) => handleResolve(msg.id, r)}
                  onDelete={() => handleDelete(msg.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
