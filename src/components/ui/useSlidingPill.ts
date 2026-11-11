'use client'
// src/components/ui/useSlidingPill.ts — Indicatore "a pillola" che scivola
// sotto la voce attiva, in CSS puro (FLIP su `transform`).
//
// Perché non `layoutId` di Motion: le animazioni di layout girano sul thread
// principale, e queste pillole si muovono proprio mentre Next sta caricando e
// idratando la pagina successiva (navigazione, router.replace) → frame persi.
// Una transizione CSS su `transform` viene composta dal browser anche con il
// thread principale occupato.
//
// Uso: contenitore `relative` con ref `containerRef`; ogni voce ha
// `data-pill-key`; la pillola è uno <span ref={pillRef}> `absolute left-0 top-0`
// dentro il contenitore, prima delle voci (che stanno sopra con `relative`).
import { useEffect, useLayoutEffect, useRef } from 'react'

type Box = { x: number; y: number; w: number; h: number }

const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)' // --ease-out-strong
const DURATION = 300

export function useSlidingPill<C extends HTMLElement = HTMLElement>(activeKey: string | null) {
  const containerRef = useRef<C>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  const prev = useRef<Box | null>(null)

  // Misura la voce attiva e piazza la pillola; anima solo se c'era una posizione precedente.
  function place(animate: boolean) {
    const c = containerRef.current
    const p = pillRef.current
    if (!c || !p) return
    const el = activeKey === null ? null : c.querySelector<HTMLElement>(`[data-pill-key="${CSS.escape(activeKey)}"]`)
    if (!el || el.offsetWidth === 0) {
      p.style.opacity = '0'
      prev.current = null
      return
    }
    const box: Box = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }
    const from = prev.current
    // Nessun cambiamento: non toccare gli stili, o si interrompe una transizione in corso
    if (from && from.x === box.x && from.y === box.y && from.w === box.w && from.h === box.h) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Interrompibile: se la pillola si sta ancora muovendo, si riparte da dove
    // è adesso sullo schermo (valore calcolato), non dalla destinazione di prima.
    let start = from
    if (from && p.getAnimations().length > 0) {
      const m = new DOMMatrixReadOnly(getComputedStyle(p).transform)
      start = { x: m.m41, y: m.m42, w: from.w * m.a, h: from.h * m.d }
    }

    p.style.transition = 'none'
    p.style.width = `${box.w}px`
    p.style.height = `${box.h}px`
    p.style.opacity = '1'
    if (animate && start && !reduce) {
      // FLIP: parte dalla posizione e misura correnti (scala), arriva alla nuova
      p.style.transform = `translate(${start.x}px, ${start.y}px) scale(${start.w / box.w}, ${start.h / box.h})`
      void p.offsetWidth // forza lo stile iniziale prima della transizione
      p.style.transition = `transform ${DURATION}ms ${EASE}`
    }
    p.style.transform = `translate(${box.x}px, ${box.y}px)`
    prev.current = box
  }

  useLayoutEffect(() => {
    place(true)
  })

  // Ridimensionamenti (finestra, font caricati, drawer che compare): riposiziona senza animare
  useEffect(() => {
    const c = containerRef.current
    if (!c || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => place(false))
    ro.observe(c)
    return () => ro.disconnect()
  }, [activeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return { containerRef, pillRef }
}
