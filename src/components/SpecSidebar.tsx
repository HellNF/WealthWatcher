// src/components/SpecSidebar.tsx
'use client'

import { useEffect, useState } from 'react'
import type { Heading } from '@/lib/spec'

interface Props {
  headings: Heading[]
}

export default function SpecSidebar({ headings }: Props) {
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id)
        }
      },
      { rootMargin: '-20% 0px -60% 0px' }
    )

    headings.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [headings])

  const filtered = headings.filter((h) => h.level <= 3)

  return (
    <nav className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
        Indice
      </p>
      <ul className="space-y-1">
        {filtered.map((h) => (
          <li key={h.id} style={{ paddingLeft: `${(h.level - 1) * 12}px` }}>
            <a
              href={`#${h.id}`}
              className={`block text-sm py-0.5 transition-colors ${
                activeId === h.id
                  ? 'text-emerald-400 font-medium'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
