'use client'
// Barra traslucida che compare in alto quando l'elemento osservato (di solito
// il titolo o il numero chiave della pagina) esce dallo schermo: il contesto
// resta a portata d'occhio mentre si scorre. Solo desktop: su mobile c'è già
// la top bar della sidebar.
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { PAGE_SHELL_X } from './pageShell'

interface Props {
  /** id dell'elemento da osservare */
  watchId: string
  children: React.ReactNode
  /** true se la barra contiene controlli: resta raggiungibile da tastiera e screen reader */
  interactive?: boolean
}

export function StickyBar({ watchId, children, interactive }: Props) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const target = document.getElementById(watchId)
    if (!target) return
    const io = new IntersectionObserver(([entry]) => setShown(!entry.isIntersecting), { threshold: 0 })
    io.observe(target)
    return () => io.disconnect()
  }, [watchId])

  return (
    <div className="sticky top-0 z-10 h-0 hidden lg:block" aria-hidden={interactive ? undefined : true}>
      <div
        inert={!shown ? true : undefined}
        className={cn(
          'absolute inset-x-0 top-0 h-12 flex items-center border-b',
          'bg-(--bg)/75 backdrop-blur-xl backdrop-saturate-150 border-(--border)/70',
          'motion-safe:transition-[opacity,transform] duration-200 ease-out-strong motion-reduce:transition-opacity',
          '[@media(prefers-reduced-transparency:reduce)]:bg-(--bg) [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none',
          shown ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none motion-reduce:translate-y-0',
        )}
      >
        <div className={cn('flex items-center gap-3', PAGE_SHELL_X)}>{children}</div>
      </div>
    </div>
  )
}
