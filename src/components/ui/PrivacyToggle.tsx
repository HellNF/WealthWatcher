'use client'
// src/components/ui/PrivacyToggle.tsx — Modalità privacy: sfoca importi, saldi
// e assi dei grafici in tutta l'app (per mostrare lo schermo o lavorare in
// pubblico). Lo stato vive su <html data-privacy="on">, così le regole CSS in
// globals.css valgono ovunque senza toccare i singoli componenti; è salvato in
// localStorage e riapplicato prima del primo paint da THEME_SCRIPT.
//
// Più pulsanti sulla stessa pagina (barra laterale, testata della dashboard)
// restano allineati: leggono lo stato dal DOM tramite useSyncExternalStore.
import { useEffect, useSyncExternalStore } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Tooltip } from '@/components/ui/Tooltip'

const STORAGE_KEY = 'ww-privacy'
const EVENT = 'ww-privacy-change'

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  return () => window.removeEventListener(EVENT, cb)
}

function read(): boolean {
  return document.documentElement.dataset.privacy === 'on'
}

function setPrivacy(on: boolean) {
  const root = document.documentElement
  if (on) root.dataset.privacy = 'on'
  else delete root.dataset.privacy
  try { localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off') } catch { /* storage bloccato: vale solo per questa pagina */ }
  window.dispatchEvent(new Event(EVENT))
}

function usePrivacy(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, read, () => false)
  return [on, setPrivacy]
}

interface PrivacyToggleProps {
  /** `icon`: solo icona (testate, barra mobile); `label`: icona + testo (barra laterale). */
  mode?: 'icon' | 'label'
  className?: string
}

export function PrivacyToggle({ mode = 'icon', className }: PrivacyToggleProps) {
  const [on, set] = usePrivacy()

  // Allinea lo stato se cambia in un'altra scheda (evento `storage`).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      const want = e.newValue === 'on'
      if (want !== read()) {
        const root = document.documentElement
        if (want) root.dataset.privacy = 'on'
        else delete root.dataset.privacy
        window.dispatchEvent(new Event(EVENT))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const label = on ? 'Mostra gli importi' : 'Nascondi gli importi'
  const Icon = on ? EyeOff : Eye

  return (
    <Tooltip content={`${label} (modalità privacy)`}>
      <button
        type="button"
        onClick={() => set(!on)}
        aria-pressed={on}
        aria-label={mode === 'icon' ? label : undefined}
        className={cn(
          'privacy-keep inline-flex items-center justify-center gap-1.5 rounded-lg text-xs transition-[color,background-color,transform,scale,translate] duration-150 ease-out-strong active:scale-95',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--ring)',
          mode === 'icon' ? 'size-8' : 'h-8 px-2.5',
          on
            ? 'bg-(--brand-subtle) text-(--brand-text)'
            : 'text-(--muted) hover:text-(--ink) hover:bg-(--surface-2)',
          className,
        )}
      >
        <Icon className="size-4 shrink-0" strokeWidth={1.75} />
        {mode === 'label' && <span>{on ? 'Privacy attiva' : 'Modalità privacy'}</span>}
      </button>
    </Tooltip>
  )
}
