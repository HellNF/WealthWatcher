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
  ChevronRight,
  Target,
  TrendingUp,
  Landmark,
  Home,
  PiggyBank,
  CalendarClock,
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
  { label: 'Dashboard',    href: '/dashboard',              icon: LayoutDashboard, exact: true },
  { label: 'Report',       href: '/dashboard/reports',      icon: BarChart3 },
  { label: 'Budget',       href: '/dashboard/budgets',      icon: Target },
  { label: 'Statistiche',  href: '/dashboard/statistiche',  icon: TrendingUp },
  { label: 'Tasse',        href: '/dashboard/tasse',        icon: Landmark },
  { label: 'Mutui',        href: '/dashboard/mutui',        icon: Home },
  { label: 'Obiettivi',    href: '/dashboard/obiettivi',    icon: PiggyBank },
  { label: 'Scadenziario', href: '/dashboard/scadenziario', icon: CalendarClock },
  { label: 'Impostazioni', href: '/dashboard/settings',     icon: Settings },
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
    <nav className="flex-1 px-3 py-2 space-y-0.5" aria-label="Navigazione principale">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-100',
              active
                ? 'bg-[--brand-subtle] text-[--brand-text] font-medium'
                : 'text-[--muted] hover:bg-[--surface-2] hover:text-[--ink]',
            )}
            aria-current={active ? 'page' : undefined}
          >
            <item.icon className="size-[18px] shrink-0" strokeWidth={1.75} />
            <span>{item.label}</span>
            {active && (
              <ChevronRight className="size-3.5 ml-auto text-[--brand]" />
            )}
          </Link>
        )
      })}
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
            className="p-1 text-[--faint] hover:text-[--danger] transition-colors duration-100"
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
          <Link href="/dashboard" aria-label="Torna alla dashboard">
            <BrandMark size="md" showName />
          </Link>
        </div>

        {navContent}
        {userFooter}
      </aside>

      {/* ── Mobile top bar ──────────────────────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-[--border] bg-[--surface]/90 backdrop-blur-sm">
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
          {/* Overlay */}
          <div
            className="fixed inset-0 z-[30] bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          {/* Drawer */}
          <aside
            className={cn(
              'fixed inset-y-0 left-0 z-[31] w-72 flex flex-col',
              'bg-[--surface] border-r border-[--border] lg:hidden',
              'transition-transform duration-200 ease-out',
              mobileOpen ? 'translate-x-0' : '-translate-x-full',
            )}
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
