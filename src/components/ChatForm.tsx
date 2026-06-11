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
  const [editingName, setEditingName] = useState(false)
  const contentRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem(AUTHOR_KEY)
    if (saved) setAuthor(saved)
    else setEditingName(true)
  }, [])

  // Auto-grow textarea
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [content])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedAuthor = author.trim()
    const trimmedContent = content.trim()

    if (!trimmedAuthor) { setEditingName(true); setError('Inserisci il tuo nome'); return }
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
      setEditingName(false)
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
    <form onSubmit={handleSubmit} className="border-t border-zinc-800 px-4 pt-3 pb-4 flex flex-col gap-2">
      {error && (
        <p className="text-red-400 text-xs px-1">{error}</p>
      )}

      {/* Textarea auto-growing */}
      <textarea
        ref={contentRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Proponi una modifica o nuova feature…"
        maxLength={1000}
        rows={3}
        className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-600 transition-colors resize-none leading-relaxed"
      />

      {/* Bottom bar: nome + counter + invio */}
      <div className="flex items-center gap-2">
        {editingName ? (
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            onBlur={() => { if (author.trim()) setEditingName(false) }}
            placeholder="Il tuo nome"
            maxLength={50}
            autoFocus
            className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-600 transition-colors"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="flex-1 text-left text-xs text-zinc-500 hover:text-zinc-300 transition-colors truncate px-1"
          >
            <span className="text-zinc-600">come</span>{' '}
            <span className="text-zinc-400 font-medium">{author}</span>
            <span className="text-zinc-700 ml-1">· cambia</span>
          </button>
        )}

        <span className="text-xs text-zinc-700 shrink-0">{content.length}/1000</span>

        <button
          type="submit"
          disabled={sending}
          className="shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1.5 text-sm font-medium text-white transition-colors"
        >
          {sending ? '…' : 'Invia'}
        </button>
      </div>

      <p className="text-xs text-zinc-700 px-1">Invio per inviare · Shift+Invio per andare a capo</p>
    </form>
  )
}
