// src/components/SpecViewer.tsx
import { readSpec } from '@/lib/spec'

export default function SpecViewer() {
  const { html } = readSpec()

  return (
    <article
      className="prose prose-invert prose-zinc max-w-none
        prose-headings:text-zinc-100 prose-headings:font-semibold
        prose-p:text-zinc-300 prose-li:text-zinc-300
        prose-code:text-emerald-400 prose-code:bg-zinc-800 prose-code:px-1 prose-code:rounded
        prose-pre:bg-zinc-800 prose-pre:border prose-pre:border-zinc-700
        prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline
        prose-blockquote:border-l-emerald-500 prose-blockquote:text-zinc-400
        prose-table:text-zinc-300 prose-th:text-zinc-100
        prose-hr:border-zinc-700"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
