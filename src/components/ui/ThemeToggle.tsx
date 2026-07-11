'use client'

import { useId } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { motion, LayoutGroup } from 'motion/react'
import { useTheme } from '@/components/providers/ThemeProvider'
import { cn } from '@/lib/cn'

type DisplayMode = 'icon' | 'icon+label'

interface ThemeToggleProps {
  mode?: DisplayMode
  className?: string
}

export function ThemeToggle({ mode = 'icon', className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const groupId = useId()

  const options = [
    { value: 'light' as const,  Icon: Sun,     label: 'Chiaro'  },
    { value: 'dark'  as const,  Icon: Moon,    label: 'Scuro'   },
    { value: 'system' as const, Icon: Monitor, label: 'Sistema' },
  ]

  return (
    <LayoutGroup id={groupId}>
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
                'relative flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors duration-150',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[--ring]',
                active ? 'text-[--ink]' : 'text-[--muted] hover:text-[--ink]',
              )}
            >
              {active && (
                <motion.span
                  layoutId="theme-toggle-pill"
                  className="absolute inset-0 rounded-md bg-[--surface] shadow-[--shadow-sm]"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <Icon className="relative z-10 size-3.5 shrink-0" />
              {mode === 'icon+label' && <span className="relative z-10">{label}</span>}
            </button>
          )
        })}
      </div>
    </LayoutGroup>
  )
}
