// src/components/ChatBubble.tsx
import type { Message } from '@/lib/messages'

interface Props {
  message: Message
  isOwn: boolean
}

function formatTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ChatBubble({ message, isOwn }: Props) {
  return (
    <div className={`flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-center gap-2 text-xs text-zinc-500 ${isOwn ? 'flex-row-reverse' : ''}`}>
        <span className="font-medium text-zinc-400">{message.author}</span>
        <span>{formatTime(message.created_at)}</span>
      </div>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words ${
          isOwn
            ? 'bg-emerald-700 text-white rounded-tr-sm'
            : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
        }`}
      >
        {message.content}
      </div>
    </div>
  )
}
