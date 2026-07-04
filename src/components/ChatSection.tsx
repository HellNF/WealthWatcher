'use client'

import { useCallback, useEffect, useState } from 'react'
import ChatFeed from './ChatFeed'
import ChatForm from './ChatForm'
import type { Message } from '@/lib/messages'

const AUTHOR_KEY = 'ww_author'

interface Props {
  initialMessages: Message[]
  isAdmin?: boolean
}

export default function ChatSection({ initialMessages, isAdmin = false }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [ownAuthor, setOwnAuthor] = useState<string | null>(null)

  useEffect(() => {
    setOwnAuthor(localStorage.getItem(AUTHOR_KEY))
  }, [])

  const handleNewMessages = useCallback((newMsgs: Message[]) => {
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id))
      return [...prev, ...newMsgs.filter((m) => !existingIds.has(m.id))]
    })
  }, [])

  function handleSent(message: Message) {
    setMessages((prev) => [...prev, message])
    setOwnAuthor(message.author)
    localStorage.setItem(AUTHOR_KEY, message.author)
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
      <ChatForm onSent={handleSent} />
    </div>
  )
}
