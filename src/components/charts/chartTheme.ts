'use client'
// Palette e stili comuni dei grafici Recharts. Gli attributi SVG non leggono le
// variabili CSS, quindi i colori arrivano qui come valori, scelti dal tema attivo.
import type { CSSProperties } from 'react'
import { useTheme } from '@/components/providers/ThemeProvider'

const LIGHT = {
  dark:   false,
  grid:   'oklch(0.88 0.005 160)',
  axis:   'oklch(0.45 0.01 160)',
  faint:  'oklch(0.65 0.008 160)', // linee di riferimento, serie di confronto
  soft:   'oklch(0.40 0.01 160)',  // serie neutra principale (uscite, spesa)
  strong: 'oklch(0.25 0.01 160)',  // serie in evidenza
  brand:  '#059669',
  danger: '#dc2626',
  violet: '#7c3aed',
  blue:   '#2563eb',
  amber:  '#d97706',
  tooltipBg:     '#ffffff',
  tooltipBorder: 'oklch(0.88 0.005 160)',
}

const DARK: typeof LIGHT = {
  dark:   true,
  grid:   'oklch(0.26 0.01 160)',
  axis:   'oklch(0.72 0.01 160)',
  faint:  'oklch(0.42 0.01 160)',
  soft:   'oklch(0.80 0.01 160)',
  strong: 'oklch(0.92 0.01 160)',
  brand:  '#34d399',
  danger: '#f87171',
  violet: '#a78bfa',
  blue:   '#60a5fa',
  amber:  '#f59e0b',
  tooltipBg:     '#1a2421',
  tooltipBorder: 'oklch(0.26 0.01 160)',
}

function withStyles(p: typeof LIGHT) {
  return {
    ...p,
    tooltip: {
      background: p.tooltipBg,
      border: `1px solid ${p.tooltipBorder}`,
      borderRadius: 10,
      fontSize: 12,
      boxShadow: '0 4px 12px oklch(0 0 0 / 0.12)',
    } satisfies CSSProperties,
    tick: { fill: p.axis, fontSize: 11 },
  }
}

const THEMES = { light: withStyles(LIGHT), dark: withStyles(DARK) }
export type ChartTheme = typeof THEMES.light

export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme()
  return THEMES[resolvedTheme === 'dark' ? 'dark' : 'light']
}

const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

/** "2026-03" → "Mar 26" */
export function shortMonth(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MONTHS[parseInt(m, 10) - 1]} ${y.slice(2)}`
}
