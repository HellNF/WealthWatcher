'use client'

import { useCallback, useEffect, useState } from 'react'
import ChatFeed from './ChatFeed'
import ChatForm from './ChatForm'
import type { Message } from '@/lib/messages'

const AUTHOR_KEY = 'ww_author'

interface Props {
  initialMessages: Message[]
}

export default function ChatSection({ initialMessages }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [ownAuthor, setOwnAuthor] = useState<string | null>(null)

  useEffect(() => {
    setOwnAuthor(localStorage.getItem(AUTHOR_KEY))
  }, [])

  const handleNewMessages = useCallback((newMsgs: Message[]) => {
    setMessages((prev) => [...prev, ...newMsgs])
  }, [])

  function handleSent(message: Message) {
    setMessages((prev) => [...prev, message])
    setOwnAuthor(message.author)
    localStorage.setItem(AUTHOR_KEY, message.author)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <ChatFeed
          messages={messages}
          ownAuthor={ownAuthor}
          onNewMessages={handleNewMessages}
        />
      </div>
      <ChatForm onSent={handleSent} />
    </div>
  )
}
