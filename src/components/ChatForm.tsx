// src/components/ChatForm.tsx
'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { Message } from '@/lib/messages'

interface Props {
  onSent: (message: Message) => void
  /** false se il visitatore non ha una sessione — la scrittura richiede login (vedi POST /api/messages). */
  canPost: boolean
}

export default function ChatForm({ onSent, canPost }: Props) {
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)

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

    const trimmedContent = content.trim()
    if (!trimmedContent) { setError('Scrivi un messaggio'); return }

    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: trimmedContent }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Errore nell'invio")
        return
      }

      const message: Message = await res.json()
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

  if (!canPost) {
    return (
      <div className="border-t border-zinc-800 px-4 py-4 text-center">
        <p className="text-xs text-zinc-500">
          <Link href="/login" className="text-emerald-400 hover:text-emerald-300 transition-colors">Accedi</Link>
          {' '}per proporre modifiche o segnalare bug.
        </p>
      </div>
    )
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

      {/* Bottom bar: counter + invio */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-700 shrink-0 ml-auto">{content.length}/1000</span>

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
