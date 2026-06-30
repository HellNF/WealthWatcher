'use client'

import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'
import { cn } from '@/lib/cn'

type DisplayMode = 'icon' | 'icon+label'

interface ThemeToggleProps {
  mode?: DisplayMode
  className?: string
}

export function ThemeToggle({ mode = 'icon', className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()

  const options = [
    { value: 'light' as const,  Icon: Sun,     label: 'Chiaro'  },
    { value: 'dark'  as const,  Icon: Moon,    label: 'Scuro'   },
    { value: 'system' as const, Icon: Monitor, label: 'Sistema' },
  ]

  return (
    <div
      role="radiogroup"
      aria-label="Tema dell'interfaccia"
      className={cn(
        'flex items-center rounded-lg bg-[--surface-2] p-0.5 gap-0.5',
        className,
      )}
    >
      {options.map(({ value, Icon, label }) => {
        const active = theme === value
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => setTheme(value)}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[--ring]',
              active
                ? 'bg-[--surface] text-[--ink] shadow-[--shadow-sm]'
                : 'text-[--muted] hover:text-[--ink]',
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            {mode === 'icon+label' && <span>{label}</span>}
          </button>
        )
      })}
    </div>
  )
}
