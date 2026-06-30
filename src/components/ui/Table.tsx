import { cn } from '@/lib/cn'

/* ─── Wrapper con scroll orizzontale ───────────────────────────────────────── */

interface TableWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function TableWrapper({ className, children, ...props }: TableWrapperProps) {
  return (
    <div
      className={cn('w-full overflow-x-auto -mx-0.5 px-0.5', className)}
      {...props}
    >
      {children}
    </div>
  )
}

/* ─── Table ─────────────────────────────────────────────────────────────────── */

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children: React.ReactNode
}

export function Table({ className, children, ...props }: TableProps) {
  return (
    <table
      className={cn('w-full text-sm border-collapse', className)}
      {...props}
    >
      {children}
    </table>
  )
}

/* ─── Head ──────────────────────────────────────────────────────────────────── */

export function TableHead({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn('', className)} {...props}>
      {children}
    </thead>
  )
}

/* ─── Th ────────────────────────────────────────────────────────────────────── */

interface ThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children?: React.ReactNode
}

export function Th({ className, children, ...props }: ThProps) {
  return (
    <th
      className={cn(
        'px-3 py-2.5 text-left text-xs font-medium text-[--muted] uppercase tracking-wide',
        'bg-[--surface-2] border-b border-[--border] whitespace-nowrap',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  )
}

/* ─── Body ──────────────────────────────────────────────────────────────────── */

export function TableBody({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn('divide-y divide-[--border]', className)}
      {...props}
    >
      {children}
    </tbody>
  )
}

/* ─── Tr ────────────────────────────────────────────────────────────────────── */

interface TrProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode
  /** Riga cliccabile con hover state */
  clickable?: boolean
}

export function Tr({ className, children, clickable, ...props }: TrProps) {
  return (
    <tr
      className={cn(
        'transition-colors duration-100',
        clickable && 'cursor-pointer hover:bg-[--surface-2]',
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  )
}

/* ─── Td ────────────────────────────────────────────────────────────────────── */

interface TdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children?: React.ReactNode
  /** Cifra numerica — applica mono + tabular */
  numeric?: boolean
}

export function Td({ className, children, numeric, ...props }: TdProps) {
  return (
    <td
      className={cn(
        'px-3 py-3 text-sm text-[--ink] whitespace-nowrap',
        numeric && 'font-mono tabular-nums text-right',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  )
}
