'use client'
// src/components/ui/Tooltip.tsx — Tooltip accessibile (base-ui) al posto
// dell'attributo `title`: compare anche da tastiera, si posiziona da solo e
// nasce dal proprio elemento (transform-origin sul trigger). Dopo il primo,
// i tooltip vicini compaiono senza attesa né animazione (data-instant).
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import { cn } from '@/lib/cn'

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <BaseTooltip.Provider delay={400} closeDelay={0}>{children}</BaseTooltip.Provider>
}

interface TooltipProps {
  /** Testo del tooltip */
  content: React.ReactNode
  /** Elemento che apre il tooltip: deve accettare ref e props (button, span…) */
  children: React.ReactElement
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
  /** Solo per prove visive: tooltip aperto al primo render */
  defaultOpen?: boolean
}

export function Tooltip({ content, children, side = 'top', className, defaultOpen }: TooltipProps) {
  return (
    <BaseTooltip.Root defaultOpen={defaultOpen}>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={6} collisionPadding={8} className="z-50">
          <BaseTooltip.Popup
            className={cn(
              'max-w-64 rounded-lg px-2.5 py-1.5 text-xs leading-snug text-(--ink) text-pretty',
              'bg-(--surface) ring-1 ring-(--border) shadow-(--shadow-md)',
              'origin-(--transform-origin) transition-[scale,opacity] duration-150 ease-out-strong',
              'data-starting-style:opacity-0 data-starting-style:scale-[0.96]',
              'data-ending-style:opacity-0 data-ending-style:scale-[0.96] data-ending-style:duration-100',
              'data-instant:transition-none motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100',
              className,
            )}
          >
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )
}
