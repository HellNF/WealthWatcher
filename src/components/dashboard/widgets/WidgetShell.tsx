'use client'

import type { ReactNode, PointerEventHandler } from 'react'
import Link from 'next/link'
import { GripVertical, EyeOff, ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { WidgetSize } from './types'

interface WidgetShellProps {
  title:        string
  href?:        string
  isEditing:    boolean
  onHide:       () => void
  onDragStart?: PointerEventHandler<HTMLDivElement>
  size:         WidgetSize
  onResize:     (size: WidgetSize) => void
  children:     ReactNode
  className?:   string
}

export function WidgetShell({
  title, href, isEditing, onHide, onDragStart, size, onResize, children, className,
}: WidgetShellProps) {
  return (
    <Card className={cn(
      'relative h-full flex flex-col overflow-hidden transition-shadow duration-200',
      isEditing && 'ring-1 ring-[--border]',
      className,
    )}>
      {/* Header — non scorre */}
      <div className="flex items-center justify-between mb-3 gap-2 shrink-0">
        {/* Left: grip + title */}
        <div className="flex items-center gap-2 min-w-0">
          {isEditing && (
            <div
              onPointerDown={onDragStart}
              className="touch-none cursor-grab active:cursor-grabbing shrink-0"
            >
              <GripVertical className="size-4 text-[--muted]" strokeWidth={1.75} />
            </div>
          )}
          <h3 className="text-sm font-semibold text-[--ink] truncate">{title}</h3>
        </div>

        {/* Right: size picker (edit) | vedi tutto (view) | hide (edit) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isEditing ? (
            <>
              {/* S / M / L size picker */}
              <div className="flex items-center gap-0.5 rounded-md border border-[--border] p-0.5">
                {(['sm', 'md', 'lg'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => onResize(s)}
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase leading-none transition-all duration-200 [transition-timing-function:var(--ease-spring)] focus-visible:outline-none',
                      size === s
                        ? 'bg-[--brand] text-white'
                        : 'text-[--muted] hover:text-[--ink] hover:bg-[--surface-2]',
                    )}
                  >
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Hide button */}
              <button
                onClick={onHide}
                aria-label="Nascondi widget"
                className="size-6 flex items-center justify-center rounded-lg text-[--faint] hover:text-[--danger] hover:bg-[--danger]/10 active:scale-90 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
              >
                <EyeOff className="size-3.5" strokeWidth={1.75} />
              </button>
            </>
          ) : href ? (
            <Link
              href={href}
              className="flex items-center gap-0.5 text-xs text-[--brand-text] hover:underline focus-visible:outline-none"
            >
              Vedi tutto
              <ChevronRight className="size-3" strokeWidth={2} />
            </Link>
          ) : null}
        </div>
      </div>

      {/* Content — occupa lo spazio residuo, scorribile se overflow */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </Card>
  )
}
