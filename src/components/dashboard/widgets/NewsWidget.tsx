'use client'

import { Newspaper, ExternalLink } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import type { NewsWidgetData, WidgetSize } from './types'

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60)          return 'ora'
  if (diff < 3600)        return `${Math.floor(diff / 60)}min fa`
  if (diff < 86_400)      return `${Math.floor(diff / 3600)}h fa`
  if (diff < 86_400 * 7)  return `${Math.floor(diff / 86_400)}gg fa`
  const d = new Date(ts * 1000)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

const ARTICLES_VISIBLE: Record<WidgetSize, number> = { sm: 3, md: 4, lg: 6 }

export function NewsWidget({ data, size }: { data: NewsWidgetData; size: WidgetSize }) {
  const { articles } = data
  const limit = ARTICLES_VISIBLE[size]
  const visible = articles.slice(0, limit)

  if (articles.length === 0) {
    return (
      <EmptyState
        icon={Newspaper}
        title="Nessuna notizia disponibile"
        description="Le notizie sui tuoi strumenti appariranno qui."
      />
    )
  }

  return (
    <div className="divide-y divide-[--border] -mx-4 sm:-mx-5">
      {visible.map((a) => (
        <a
          key={a.uuid}
          href={a.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-3 px-4 sm:px-5 py-3 hover:bg-[--surface-2] transition-colors duration-100 group"
        >
          {/* Thumbnail — nascosto in sm */}
          {size !== 'sm' && (
            a.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.thumbnailUrl}
                alt=""
                className="size-10 rounded-lg object-cover shrink-0 bg-[--surface-2]"
              />
            ) : (
              <div className="size-10 rounded-lg bg-[--surface-2] flex items-center justify-center shrink-0">
                <Newspaper className="size-4 text-[--faint]" strokeWidth={1.5} />
              </div>
            )
          )}

          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[--ink] leading-snug line-clamp-2 group-hover:text-[--brand-text] transition-colors">
              {a.title}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] text-[--faint] truncate">{a.publisher}</span>
              <span className="text-[--faint] text-[10px]">·</span>
              <span className="text-[10px] text-[--faint] shrink-0">{timeAgo(a.publishedAt)}</span>
            </div>
          </div>

          <ExternalLink
            className="size-3 text-[--faint] shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            strokeWidth={1.75}
          />
        </a>
      ))}
    </div>
  )
}
