'use client'

import { useCallback, useState } from 'react'
import ChatFeed from './ChatFeed'
import ChatForm from './ChatForm'
import type { Message } from '@/lib/messages'

interface Props {
  initialMessages: Message[]
  isAdmin?: boolean
  /** Nome/email dell'utente autenticato — null se il visitatore non ha una sessione. */
  ownAuthor: string | null
  /** true se la sessione corrente può scrivere (vedi POST /api/messages). */
  canPost: boolean
}

export default function ChatSection({ initialMessages, isAdmin = false, ownAuthor, canPost }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)

  const handleNewMessages = useCallback((newMsgs: Message[]) => {
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id))
      return [...prev, ...newMsgs.filter((m) => !existingIds.has(m.id))]
    })
  }, [])

  function handleSent(message: Message) {
    setMessages((prev) => [...prev, message])
  }

  function handleResolve(id: number, resolved: boolean) {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, resolved: resolved ? 1 : 0 } : m))
    )
  }

  function handleDelete(id: number) {
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <ChatFeed
          messages={messages}
          ownAuthor={ownAuthor}
          isAdmin={isAdmin}
          onNewMessages={handleNewMessages}
          onResolve={handleResolve}
          onDelete={handleDelete}
        />
      </div>
      <ChatForm onSent={handleSent} canPost={canPost} />
    </div>
  )
}
