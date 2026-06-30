'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { BrandMark } from '@/components/ui/BrandMark'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { cn } from '@/lib/cn'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  exact?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',    href: '/dashboard',          icon: LayoutDashboard, exact: true },
  { label: 'Report',       href: '/dashboard/reports',  icon: BarChart3 },
  { label: 'Impostazioni', href: '/dashboard/settings', icon: Settings },
]

interface SidebarProps {
  user: { name?: string | null; email?: string | null; role?: string | null }
  signOutAction: () => Promise<void>
}

// Sidebar è sempre scura (light + dark mode). I CSS custom property cascadano
// ai figli (BrandMark, ThemeToggle, nav link) ridefinendo i token semantici.
// Sidebar sempre scura — teal/cyan identity, indipendente dal tema pagina.
// I CSS custom property cascadano a BrandMark, ThemeToggle, nav link.
const SIDEBAR_STYLE: React.CSSProperties = {
  background:       'oklch(0.14 0.038 205)',
  '--ink':          'oklch(0.94 0.006 205)',
  '--muted':        'oklch(0.54 0.020 205)',
  '--faint':        'oklch(0.38 0.012 205)',
  '--border':       'oklch(0.22 0.032 205)',
  '--surface':      'oklch(0.26 0.055 205)',   // active toggle button
  '--surface-2':    'oklch(0.21 0.046 205)',   // nav hover bg / toggle container
  '--brand-subtle': 'oklch(0.46 0.13 198)',    // active nav → teal pieno (4.8:1 su bianco ✓)
  '--brand-text':   'oklch(1 0 0)',            // testo bianco su teal
  '--shadow-sm':    '0 1px 3px oklch(0 0 0 / 0.40)',
  '--ring':         'oklch(0.68 0.14 198 / 0.50)',
} as React.CSSProperties

export function Sidebar({ user, signOutAction }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => { setMobileOpen(false) }, [pathname])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  function isActive(item: NavItem) {
    if (item.exact) return pathname === item.href
    return pathname.startsWith(item.href)
  }

  const navContent = (
    <nav className="flex-1 px-3 py-2 space-y-0.5" aria-label="Navigazione principale">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150',
              active
                ? 'bg-[--brand-subtle] text-[--brand-text] font-semibold shadow-[--shadow-sm]'
                : 'text-[--muted] hover:bg-[--surface-2] hover:text-[--ink]',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <item.icon
              className={cn('size-[18px] shrink-0', active ? 'text-white' : '')}
              strokeWidth={active ? 2 : 1.75}
            />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )

  const userFooter = (
    <div className="px-3 py-3 border-t border-[--border] space-y-3">
      <ThemeToggle mode="icon+label" className="w-full justify-center" />
      <div className="flex items-center gap-2 px-1">
        <div className="size-7 rounded-full bg-[--brand-subtle] flex items-center justify-center shrink-0">
          <span className="text-xs font-semibold text-[--brand-text]">
            {(user.name ?? user.email ?? '?')[0].toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[--ink] truncate">
            {user.name ?? user.email}
          </p>
          {user.role === 'admin' && (
            <p className="text-[10px] text-[--muted]">admin</p>
          )}
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-[--faint] hover:text-[--danger] transition-colors duration-100"
            title="Esci"
            aria-label="Esci dall'account"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </div>
  )

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col w-60 shrink-0 h-screen sticky top-0 border-r"
        style={SIDEBAR_STYLE}
        aria-label="Barra laterale"
      >
        <div className="px-4 py-4 border-b border-[--border]">
          <Link href="/dashboard" aria-label="Torna alla dashboard">
            <BrandMark size="md" showName />
          </Link>
        </div>
        {navContent}
        {userFooter}
      </aside>

      {/* ── Mobile top bar ──────────────────────────────────────────────────── */}
      <header
        className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b backdrop-blur-md"
        style={{ ...SIDEBAR_STYLE, background: 'oklch(0.14 0.040 162 / 0.92)' }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          className="text-[--muted] hover:text-[--ink] transition-colors"
          aria-label="Apri menu"
          aria-expanded={mobileOpen}
        >
          <Menu className="size-5" />
        </button>
        <Link href="/dashboard" aria-label="Torna alla dashboard">
          <BrandMark size="sm" showName />
        </Link>
        <div className="ml-auto">
          <ThemeToggle mode="icon" />
        </div>
      </header>

      {/* ── Mobile drawer ───────────────────────────────────────────────────── */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-[30] bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside
            className={cn(
              'fixed inset-y-0 left-0 z-[31] w-72 flex flex-col border-r lg:hidden',
              'transition-transform duration-200 ease-out',
              mobileOpen ? 'translate-x-0' : '-translate-x-full',
            )}
            style={SIDEBAR_STYLE}
            aria-label="Menu mobile"
          >
            <div className="px-4 py-4 border-b border-[--border] flex items-center justify-between">
              <BrandMark size="md" showName />
              <button
                onClick={() => setMobileOpen(false)}
                className="text-[--faint] hover:text-[--ink] transition-colors"
                aria-label="Chiudi menu"
              >
                <X className="size-5" />
              </button>
            </div>
            {navContent}
            {userFooter}
          </aside>
        </>
      )}
    </>
  )
}
