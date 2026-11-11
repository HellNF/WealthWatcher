// src/components/ui/HeroFigure.tsx — Il numero grande in testata (patrimonio,
// saldo, valore...). Resta della dimensione massima finché entra; se lo spazio
// non basta (schermo stretto, zoom, importi milionari) si rimpicciolisce per
// stare sempre su una riga, senza uscire dal riquadro né andare a capo a metà.
//
// Come: il contenitore è un container query (`container-type: inline-size`) e
// la dimensione è min(massimo, larghezza / numero di caratteri). Il massimo
// segue i breakpoint come prima (es. text-5xl sotto sm, text-7xl sopra).
import { cn } from '@/lib/cn'

const MAX: Record<HeroFigureSize, string> = {
  xs: '[--fig-max:1.875rem] sm:[--fig-max:2.25rem]', // text-3xl → sm:text-4xl
  sm: '[--fig-max:1.875rem] sm:[--fig-max:3rem]',  // text-3xl → sm:text-5xl
  md: '[--fig-max:2.25rem] sm:[--fig-max:3rem]',   // text-4xl → sm:text-5xl
  lg: '[--fig-max:3rem] sm:[--fig-max:3.75rem]',   // text-5xl → sm:text-6xl
  xl: '[--fig-max:3rem] sm:[--fig-max:4.5rem]',    // text-5xl → sm:text-7xl
}

export type HeroFigureSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

// Larghezza media di un carattere del numero (cifre tabellari Bricolage
// extrabold con tracking −0.03em), in em; un po' abbondante per sicurezza.
const CHAR_EM = 0.64

export function HeroFigure({
  value, size = 'lg', className, containerClassName, fitChars, id, as: Tag = 'p', children, ...rest
}: {
  /** Il numero già formattato: serve anche a calcolare la dimensione */
  value:      string
  /** Al posto del testo (es. una cifra animata); la dimensione resta calcolata su `value` */
  children?:  React.ReactNode
  size?:      HeroFigureSize
  className?: string
  /** Classi del contenitore: es. `flex-1` per stare in riga con un badge. */
  containerClassName?: string
  /** Lunghezza su cui calcolare la scala: per numeri affiancati, la più lunga del gruppo, così hanno tutti la stessa dimensione. */
  fitChars?: number
  id?:        string
  as?:        'p' | 'span' | 'div'
} & Omit<React.HTMLAttributes<HTMLElement>, 'children'>) {
  const fit = 100 / (Math.max(fitChars ?? value.length, value.length, 4) * CHAR_EM)
  return (
    <div className={cn('w-full min-w-0 [container-type:inline-size]', MAX[size], containerClassName)}>
      <Tag
        id={id}
        {...rest}
        style={{ fontSize: `min(var(--fig-max), ${fit.toFixed(2)}cqi)` }}
        className={cn(
          'whitespace-nowrap font-extrabold font-display tabular-nums leading-none tracking-[-0.03em]',
          className,
        )}
      >
        {children ?? value}
      </Tag>
    </div>
  )
}
