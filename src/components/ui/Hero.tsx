import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Sezione hero di una pagina: architettura a doppia cornice (guscio esterno +
 * nucleo interno con raggi concentrici), come una lastra appoggiata in un
 * vassoio. È l'unico contenitore dell'app con questo trattamento: segnala
 * "qui c'è la risposta principale". Entra con un fade-up breve, una volta.
 */
export function HeroShell({ children, className, innerClassName }: {
  children: React.ReactNode
  /** Classi del guscio esterno (layout nella pagina: flex-1, col-span…) */
  className?: string
  /** Classi del contenuto dentro il nucleo */
  innerClassName?: string
}) {
  return (
    <div className={cn('hero-enter flex flex-col rounded-[1.75rem] p-1.5 bg-(--bezel) ring-1 ring-(--border)/60', className)}>
      <div className="relative flex-1 flex flex-col overflow-hidden rounded-[calc(1.75rem-0.375rem)] bg-(--surface) ring-1 ring-(--border) shadow-[var(--shadow-md),var(--highlight)]">
        {/* luce ambientale neutra dall'alto: profondità senza colore */}
        <div aria-hidden className="pointer-events-none absolute inset-0 [background-image:var(--hero-glow)]" />
        <div className={cn('relative flex-1 flex flex-col', innerClassName)}>{children}</div>
      </div>
    </div>
  )
}

/** Etichetta a pillola sopra il dato principale dell'hero. Una per hero, non per sezione. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn(
      'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em]',
      'text-(--muted) bg-(--surface-2) ring-1 ring-inset ring-(--border)',
      className,
    )}>
      {children}
    </p>
  )
}

/** Link-azione dell'hero: pillola con l'icona annidata nel proprio cerchio ("button-in-button"). */
export function HeroLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'group inline-flex items-center gap-2.5 rounded-full pl-4 pr-1.5 py-1.5 text-sm font-medium text-(--ink)',
        'bg-(--surface-2) ring-1 ring-inset ring-(--border) hover:bg-(--surface)',
        'transition-[transform,background-color] duration-300 ease-drawer active:scale-[0.98]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)',
        className,
      )}
    >
      {children}
      <span className="flex size-7 items-center justify-center rounded-full bg-(--ink)/8 transition-transform duration-500 ease-drawer group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-105 motion-reduce:transform-none">
        <ArrowUpRight className="size-3.5" strokeWidth={1.5} aria-hidden />
      </span>
    </Link>
  )
}
