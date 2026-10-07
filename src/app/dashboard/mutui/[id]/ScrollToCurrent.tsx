'use client'
// Porta in vista la rata in corso dentro la tabella scorrevole del piano di
// ammortamento. Istantaneo: è un posizionamento iniziale, non un'animazione.
import { useEffect, useRef } from 'react'

export default function ScrollToCurrent({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const box = ref.current
    const row = box?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!box || !row) return
    // due righe di contesto sopra quella corrente, sotto l'intestazione fissa
    box.scrollTop = Math.max(0, row.offsetTop - row.offsetHeight * 3)
  }, [])

  return <div ref={ref} className={className}>{children}</div>
}
