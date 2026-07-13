import { Check, CheckCheck, Trash2 } from 'lucide-react'
import type { Message } from '@/lib/messages'
import { formatTimeIt } from '@/lib/formatDate'

interface Props {
  message: Message
  isOwn: boolean
  isAdmin?: boolean
  onResolve?: (resolved: boolean) => void
  onDelete?: () => void
}

function formatTime(unixSeconds: number): string {
  return formatTimeIt(unixSeconds, { hour: '2-digit', minute: '2-digit' })
}

export default function ChatBubble({ message, isOwn, isAdmin = false, onResolve, onDelete }: Props) {
  const isResolved = message.resolved === 1

  return (
    <div className={`group flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-center gap-2 text-xs text-zinc-500 ${isOwn ? 'flex-row-reverse' : ''}`}>
        <span className="font-medium text-zinc-400">{message.author}</span>
        <span>{formatTime(message.created_at)}</span>
        {isResolved && (
          <span className="flex items-center gap-1 text-emerald-500 font-medium">
            <CheckCheck className="size-3" />
            elaborato
          </span>
        )}
      </div>

      <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
        <div
          className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words transition-opacity ${
            isOwn
              ? 'bg-emerald-700 text-white rounded-tr-sm'
              : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
          } ${isResolved ? 'opacity-60' : ''}`}
        >
          {message.content}
        </div>

        {/* Azioni admin — visibili al hover */}
        {isAdmin && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={() => onResolve?.(!isResolved)}
              title={isResolved ? 'Segna come aperto' : 'Segna come elaborato'}
              className={`p-1 rounded-md transition-colors ${
                isResolved
                  ? 'text-emerald-500 hover:text-zinc-400 hover:bg-zinc-700'
                  : 'text-zinc-500 hover:text-emerald-400 hover:bg-zinc-700'
              }`}
            >
              <Check className="size-3.5" />
            </button>
            <button
              onClick={() => onDelete?.()}
              title="Elimina"
              className="p-1 rounded-md text-zinc-600 hover:text-red-400 hover:bg-zinc-700 transition-colors"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
