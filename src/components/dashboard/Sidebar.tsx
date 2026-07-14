'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, LayoutGroup } from 'motion/react'
import {
  LayoutDashboard,
  BarChart3,
  Settings,
  LogOut,
  X,
  ChevronRight,
  Target,
  TrendingUp,
  Landmark,
  Home,
  PiggyBank,
  CalendarClock,
  LineChart,
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

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Dashboard',
    items: [
      { label: 'Dashboard',    href: '/dashboard',              icon: LayoutDashboard, exact: true },
      { label: 'Report',       href: '/dashboard/reports',      icon: BarChart3 },
      { label: 'Statistiche',  href: '/dashboard/statistiche',  icon: TrendingUp },
      { label: 'Scadenziario', href: '/dashboard/scadenziario', icon: CalendarClock },
    ],
  },
  {
    label: 'Patrimonio',
    items: [
      { label: 'Mercati',      href: '/dashboard/mercati',      icon: LineChart },
      { label: 'Tasse',        href: '/dashboard/tasse',        icon: Landmark },
      { label: 'Mutui',        href: '/dashboard/mutui',        icon: Home },
      { label: 'Obiettivi',    href: '/dashboard/obiettivi',    icon: PiggyBank },
      { label: 'Budget',       href: '/dashboard/budgets',      icon: Target },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { label: 'Impostazioni', href: '/dashboard/settings',     icon: Settings },
    ],
  },
]

interface SidebarProps {
  user: { name?: string | null; email?: string | null; role?: string | null }
  signOutAction: () => Promise<void>
}

export function Sidebar({ user, signOutAction }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Close on Escape
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
    <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto" aria-label="Navigazione principale">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-[--faint]">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150',
                    active
                      ? 'text-[--brand-text] font-medium'
                      : 'text-[--muted] hover:bg-[--surface-2] hover:text-[--ink]',
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active-pill"
                      className="absolute inset-0 rounded-lg bg-[--brand-subtle]"
                      transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                    />
                  )}
                  <item.icon className="relative z-10 size-[18px] shrink-0" strokeWidth={1.75} />
                  <span className="relative z-10">{item.label}</span>
                  {active && (
                    <ChevronRight className="relative z-10 size-3.5 ml-auto text-[--brand]" />
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )

  const userFooter = (
    <div className="px-3 py-3 border-t border-[--border] space-y-2">
      <ThemeToggle mode="icon+label" className="w-full justify-center" />
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/profilo"
          aria-label="Profilo personale"
          className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1 rounded-lg hover:bg-[--surface-2] transition-colors duration-100"
        >
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
              <p className="text-[10px] text-[--brand-text]">admin</p>
            )}
          </div>
        </Link>
        <form action={signOutAction} className="shrink-0">
          <button
            type="submit"
            className="p-1 rounded-md text-[--faint] hover:text-[--danger] hover:bg-[--danger-subtle] active:scale-90 transition-all duration-150"
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
        className="hidden lg:flex flex-col w-60 shrink-0 h-screen sticky top-0 border-r border-[--border] bg-[--surface]"
        aria-label="Barra laterale"
      >
        {/* Brand */}
        <div className="px-4 py-4 border-b border-[--border]">
          <Link
            href="/dashboard"
            aria-label="Torna alla dashboard"
            className="inline-flex transition-transform duration-200 [transition-timing-function:var(--ease-spring)] hover:scale-[1.03] active:scale-[0.97]"
          >
            <BrandMark size="md" showName />
          </Link>
        </div>

        <LayoutGroup id="sidebar-desktop">{navContent}</LayoutGroup>
        {userFooter}
      </aside>

      {/* ── Mobile top bar ──────────────────────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-[--border] bg-[--surface]/90 backdrop-blur-md shadow-[--shadow-sm]">
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="relative size-8 -ml-1 flex items-center justify-center rounded-lg text-[--muted] hover:text-[--ink] hover:bg-[--surface-2] active:scale-90 transition-all duration-200 [transition-timing-function:var(--ease-spring)]"
          aria-label={mobileOpen ? 'Chiudi menu' : 'Apri menu'}
          aria-expanded={mobileOpen}
        >
          {/* Hamburger che si trasforma in X — 2 barre, nessuno swap di icone */}
          <span className="relative w-4 h-4" aria-hidden>
            <span
              className={cn(
                'absolute left-0 top-0 h-[1.5px] w-4 bg-current rounded-full',
                'transition-transform duration-300 [transition-timing-function:var(--ease-spring)]',
                mobileOpen && 'translate-y-[7px] rotate-45',
              )}
            />
            <span
              className={cn(
                'absolute left-0 bottom-0 h-[1.5px] w-4 bg-current rounded-full',
                'transition-transform duration-300 [transition-timing-function:var(--ease-spring)]',
                mobileOpen && '-translate-y-[7px] -rotate-45',
              )}
            />
          </span>
        </button>
        <Link
          href="/dashboard"
          aria-label="Torna alla dashboard"
          className="inline-flex transition-transform duration-200 [transition-timing-function:var(--ease-spring)] active:scale-[0.97]"
        >
          <BrandMark size="sm" showName />
        </Link>
        <div className="ml-auto">
          <ThemeToggle mode="icon" />
        </div>
      </header>

      {/* ── Mobile drawer ───────────────────────────────────────────────────── */}
      {/* Sempre montati (non condizionati a mobileOpen): solo così le transizioni
          di ingresso/uscita hanno il tempo di essere eseguite invece di scattare
          istantaneamente al mount/unmount. */}

      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 z-[30] bg-black/40 backdrop-blur-sm lg:hidden',
          'transition-opacity duration-300 [transition-timing-function:var(--ease-spring)]',
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />
      {/* Drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-[31] w-72 flex flex-col',
          'bg-[--surface] border-r border-[--border] lg:hidden',
          'transition-transform duration-300 [transition-timing-function:var(--ease-spring)]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Menu mobile"
        aria-hidden={!mobileOpen}
        inert={!mobileOpen ? true : undefined}
      >
        <div className="px-4 py-4 border-b border-[--border] flex items-center justify-between">
          <Link
            href="/dashboard"
            aria-label="Torna alla dashboard"
            className="inline-flex transition-transform duration-200 [transition-timing-function:var(--ease-spring)] active:scale-[0.97]"
          >
            <BrandMark size="md" showName />
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 rounded-md text-[--faint] hover:text-[--ink] hover:bg-[--surface-2] active:scale-90 transition-all duration-200 [transition-timing-function:var(--ease-spring)]"
            aria-label="Chiudi menu"
          >
            <X className="size-5" />
          </button>
        </div>
        <LayoutGroup id="sidebar-mobile">{navContent}</LayoutGroup>
        {userFooter}
      </aside>
    </>
  )
}
