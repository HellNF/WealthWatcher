// src/components/ChatForm.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import type { Message } from '@/lib/messages'

interface Props {
  onSent: (message: Message) => void
}

const AUTHOR_KEY = 'ww_author'

export default function ChatForm({ onSent }: Props) {
  const [author, setAuthor] = useState('')
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem(AUTHOR_KEY)
    if (saved) setAuthor(saved)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedAuthor = author.trim()
    const trimmedContent = content.trim()

    if (!trimmedAuthor) { setError('Inserisci il tuo nome'); return }
    if (!trimmedContent) { setError('Scrivi un messaggio'); return }

    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ author: trimmedAuthor, content: trimmedContent }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Errore nell'invio")
        return
      }

      const message: Message = await res.json()
      localStorage.setItem(AUTHOR_KEY, trimmedAuthor)
      setContent('')
      onSent(message)
      contentRef.current?.focus()
    } catch {
      setError('Errore di rete. Riprova.')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-zinc-800 px-4 py-3 flex flex-col gap-2">
      {error && (
        <p className="text-red-400 text-xs">{error}</p>
      )}
      <div className="flex gap-2 items-end">
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Il tuo nome"
          maxLength={50}
          className="w-28 shrink-0 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-600 transition-colors"
        />
        <textarea
          ref={contentRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Proponi una modifica o nuova feature… (Invio per inviare)"
          maxLength={1000}
          rows={1}
          className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-600 transition-colors resize-none"
        />
        <button
          type="submit"
          disabled={sending}
          className="shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          {sending ? '…' : 'Invia'}
        </button>
      </div>
      <p className="text-xs text-zinc-600 text-right">{content.length}/1000</p>
    </form>
  )
}
