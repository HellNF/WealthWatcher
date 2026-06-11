// src/components/ChatFeed.tsx
'use client'

import { useEffect, useRef } from 'react'
import ChatBubble from './ChatBubble'
import type { Message } from '@/lib/messages'

interface Props {
  messages: Message[]
  ownAuthor: string | null
  onNewMessages: (msgs: Message[]) => void
}

export default function ChatFeed({ messages, ownAuthor, onNewMessages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const poll = async () => {
      const last = messages[messages.length - 1]
      const since = last ? last.created_at : 0
      try {
        const res = await fetch(`/api/messages?since=${since}`)
        if (!res.ok) return
        const newMsgs: Message[] = await res.json()
        if (newMsgs.length > 0) onNewMessages(newMsgs)
      } catch { /* silent fail */ }
    }
    const interval = setInterval(poll, 10_000)
    return () => clearInterval(interval)
  }, [messages, onNewMessages])

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-zinc-600 text-sm">
        Nessun messaggio ancora. Sii il primo a proporre qualcosa!
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {messages.map((msg) => (
        <ChatBubble
          key={msg.id}
          message={msg}
          isOwn={ownAuthor !== null && msg.author === ownAuthor}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
