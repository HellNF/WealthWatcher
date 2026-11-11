'use client'
// src/components/dashboard/widgets/FitList.tsx — Lista che mostra solo le righe
// che entrano per intero nello spazio del widget, al posto di uno scroll interno.
//
// Perché: i widget affiancati hanno un'altezza legata al viewport. Una lista che
// scorre dentro una pagina che scorre "ruba" la rotella al passaggio del mouse e
// taglia l'ultima riga a metà. Qui le righe che non entrano vengono nascoste
// (visibility, così restano misurabili e tornano quando lo spazio cresce) e
// subito sotto l'ultima visibile compare "+N altri". Con altezza libera (mobile,
// taglia L) entra tutto e la lista si comporta come una lista normale.
//
// Misure e stili scritti nel DOM dentro il ResizeObserver: nessun render per
// ogni ridimensionamento, salvo quando cambia il numero di righe nascoste.
import { Children, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

interface FitListProps {
  children: ReactNode
  /** Testo per le righe rimaste fuori, es. (n) => `+${n} altre scadenze` */
  more: (hidden: number) => ReactNode
  /** Classi della lista (divide-y, -mx-*, space-y-*…) */
  className?: string
}

export function FitList({ children, more, className }: FitListProps) {
  const boxRef  = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLParagraphElement>(null)
  const items = Children.toArray(children)
  const [hidden, setHidden] = useState(0)
  const hasMore = hidden > 0

  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    function measure() {
      const b = boxRef.current, l = listRef.current
      if (!b || !l) return
      const rows = Array.from(l.children) as HTMLElement[]
      const top = b.getBoundingClientRect().top
      const avail = b.clientHeight + 0.5
      const bottoms = rows.map((r) => r.getBoundingClientRect().bottom - top)
      // Spazio per la riga "+N": la misura reale se c'è già, altrimenti una stima
      const moreH = moreRef.current?.offsetHeight || 28
      let n = rows.length
      if (bottoms.at(-1)! > avail) {
        n = 0
        while (n < rows.length && bottoms[n] + moreH <= avail) n++
      }
      rows.forEach((r, i) => { r.style.visibility = i < n ? '' : 'hidden' })
      if (moreRef.current) moreRef.current.style.top = `${n > 0 ? bottoms[n - 1] : 0}px`
      setHidden(rows.length - n)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    return () => ro.disconnect()
  }, [items.length, hasMore]) // con "+N" comparso si rimisura per posizionarlo

  return (
    <div ref={boxRef} className="relative flex-1 min-h-0 overflow-hidden">
      <div ref={listRef} className={className}>{items}</div>
      {hasMore && (
        <p ref={moreRef} className="absolute inset-x-0 pt-2 text-xs text-(--faint)">
          {more(hidden)}
        </p>
      )}
    </div>
  )
}

/** "+1 altra scadenza" / "+3 altre scadenze" */
export function plural(n: number, one: string, many: string): string {
  return `+${n} ${n === 1 ? one : many}`
}
