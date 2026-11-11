'use client'

import { Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'
import { Segmented } from './Segmented'

const OPTIONS = [
  { value: 'light'  as const, icon: Sun,     label: 'Chiaro'  },
  { value: 'dark'   as const, icon: Moon,    label: 'Scuro'   },
  { value: 'system' as const, icon: Monitor, label: 'Sistema' },
]

export function ThemeToggle({ mode = 'icon', className }: { mode?: 'icon' | 'icon+label'; className?: string }) {
  const { theme, setTheme } = useTheme()
  const options = OPTIONS.map((o) => mode === 'icon' ? { ...o, label: null, ariaLabel: o.label } : o)
  return <Segmented options={options} value={theme} onChange={setTheme} label="Tema dell'interfaccia" size="sm" className={className} />
}
