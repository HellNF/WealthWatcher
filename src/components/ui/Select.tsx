'use client'
// src/components/ui/Select.tsx — Select dell'app su base-ui al posto della
// <select> nativa: lista con la grafica dell'app (anche in tema scuro),
// navigazione da tastiera e ricerca per lettere, e con il mouse la voce scelta
// si apre allineata al valore nel campo (come su macOS). Nei form funziona come
// prima: con `name` il valore viaggia in un input nascosto.
import { Children, Fragment, isValidElement } from 'react'
import { Select as BaseSelect } from '@base-ui/react/select'
import { Check, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface SelectOption {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

export interface SelectGroup {
  label: string
  options: SelectOption[]
}

export interface SelectProps {
  /** Opzioni semplici, oppure gruppi con etichetta (come <optgroup>) */
  options?: SelectOption[] | SelectGroup[]
  /** In alternativa a `options`: <option>/<optgroup> come nella select nativa */
  children?: React.ReactNode
  value?: string | number
  defaultValue?: string | number
  onValueChange?: (value: string) => void
  /** Compatibilità con la select nativa: riceve `{ target: { value } }` */
  onChange?: (event: { target: { value: string } }) => void
  /** Nome del campo nei form (server action) */
  name?: string
  id?: string
  required?: boolean
  disabled?: boolean
  /** Testo quando nessuna voce è scelta */
  placeholder?: string
  error?: boolean
  size?: 'sm' | 'md'
  className?: string
  'aria-label'?: string
}

function isGrouped(o: SelectOption[] | SelectGroup[]): o is SelectGroup[] {
  return o.length > 0 && 'options' in o[0]
}

type OptionEl = React.ReactElement<{ value?: string | number; disabled?: boolean; children?: React.ReactNode; label?: string }>

/** Appiattisce array e frammenti, così <option> generate con map() o dentro <>…</> vengono lette tutte. */
function flatten(children: React.ReactNode): OptionEl[] {
  const out: OptionEl[] = []
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.type === Fragment) out.push(...flatten((child.props as { children?: React.ReactNode }).children))
    else out.push(child as OptionEl)
  })
  return out
}

function toOption(el: OptionEl): SelectOption {
  const { value, children, disabled } = el.props
  return { value: String(value ?? ''), label: children, disabled }
}

/** Converte <option>/<optgroup> nella forma di `options`. */
function optionsFromChildren(children: React.ReactNode): SelectOption[] | SelectGroup[] {
  const els = flatten(children)
  if (els.some((el) => el.type === 'optgroup')) {
    const groups: SelectGroup[] = []
    let loose: SelectOption[] = []
    for (const el of els) {
      if (el.type === 'optgroup') {
        if (loose.length) { groups.push({ label: '', options: loose }); loose = [] }
        groups.push({ label: el.props.label ?? '', options: flatten(el.props.children).map(toOption) })
      } else if (el.type === 'option') loose.push(toOption(el))
    }
    if (loose.length) groups.push({ label: '', options: loose })
    return groups.filter((g) => g.options.length > 0)
  }
  return els.filter((el) => el.type === 'option').map(toOption)
}

const ITEM = cn(
  'grid grid-cols-[0.875rem_1fr] items-center gap-2 rounded-md py-1.5 pl-2 pr-3 text-sm text-(--ink)',
  'cursor-default select-none outline-none [overflow-wrap:anywhere]',
  'data-highlighted:bg-(--surface-2) data-disabled:opacity-40',
)

const SCROLL_ARROW = cn(
  'absolute inset-x-0 z-10 flex h-6 cursor-default items-center justify-center bg-(--surface) text-(--faint)',
  'transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0',
)

function Item({ option }: { option: SelectOption }) {
  return (
    <BaseSelect.Item value={option.value} disabled={option.disabled} className={ITEM}>
      <BaseSelect.ItemIndicator className="col-start-1 text-(--brand)">
        <Check className="size-3.5" strokeWidth={2.25} />
      </BaseSelect.ItemIndicator>
      <BaseSelect.ItemText className="col-start-2 min-w-0">{option.label}</BaseSelect.ItemText>
    </BaseSelect.Item>
  )
}

export function Select({
  options: optionsProp, children, value, defaultValue, onValueChange, onChange, name, id, required, disabled,
  placeholder, error, size = 'md', className, ...aria
}: SelectProps) {
  const options = optionsProp ?? optionsFromChildren(children)
  const flat = isGrouped(options) ? options.flatMap((g) => g.options) : options
  // Come la select nativa: senza valore iniziale né placeholder vale la prima voce
  const initial = defaultValue !== undefined
    ? String(defaultValue)
    : value === undefined && !placeholder ? flat[0]?.value : undefined
  // Mappa valore → etichetta, così il campo mostra l'etichetta e non il valore grezzo
  const items = flat.map((o) => ({ value: o.value, label: o.label }))

  return (
    <BaseSelect.Root
      items={items}
      value={value === undefined ? undefined : String(value)}
      defaultValue={initial}
      onValueChange={(v) => {
        const next = (v as string | null) ?? ''
        onValueChange?.(next)
        onChange?.({ target: { value: next } })
      }}
      name={name}
      required={required}
      disabled={disabled}
    >
      <BaseSelect.Trigger
        id={id}
        aria-label={aria['aria-label']}
        aria-invalid={error ? true : undefined}
        className={cn(
          'group inline-flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-(--border) bg-(--surface-2) text-(--ink)',
          'cursor-pointer select-none text-left transition-[border-color,box-shadow,scale] duration-150 ease-out-strong',
          'hover:border-(--faint)/60 active:scale-[0.99]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:border-(--brand)',
          'data-popup-open:border-(--brand) data-popup-open:ring-2 data-popup-open:ring-(--ring)',
          'data-disabled:cursor-not-allowed data-disabled:opacity-50',
          'aria-[invalid=true]:border-(--danger)',
          size === 'sm' ? 'h-7 px-2 text-xs' : 'h-9 px-3 text-sm',
          className,
        )}
      >
        <BaseSelect.Value
          placeholder={placeholder}
          // Grigio solo per un vero segnaposto: una voce con valore vuoto
          // ("Tutti i conti", "Nessuna") è una scelta, non un campo vuoto.
          className={cn('min-w-0 truncate', placeholder && 'data-placeholder:text-(--faint)')}
        />
        <BaseSelect.Icon className="shrink-0 text-(--faint) transition-colors group-hover:text-(--muted)">
          <ChevronsUpDown className={size === 'sm' ? 'size-3' : 'size-3.5'} />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>

      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={6} collisionPadding={8} className="z-50 outline-none select-none">
          <BaseSelect.Popup
            className={cn(
              'relative min-w-(--anchor-width) max-w-[min(24rem,calc(100vw-1rem))] rounded-xl bg-(--surface) p-1',
              'ring-1 ring-(--border) shadow-[var(--shadow-lg),var(--highlight)] outline-none',
              'origin-(--transform-origin) transition-[scale,opacity] duration-150 ease-out-strong',
              'data-starting-style:opacity-0 data-starting-style:scale-[0.97]',
              'data-ending-style:opacity-0 data-ending-style:scale-[0.97] data-ending-style:duration-100',
              // Allineata al campo (mouse): niente scala, compare e basta
              'data-[side=none]:data-starting-style:scale-100 data-[side=none]:data-ending-style:scale-100',
              'motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100',
            )}
          >
            {/* Con il mouse la lista si allinea al campo e può arrivare al bordo dello
                schermo: le frecce dicono che continua e la fanno scorrere al passaggio. */}
            <BaseSelect.ScrollUpArrow className={SCROLL_ARROW + ' top-0 rounded-t-xl'}>
              <ChevronUp className="size-3.5" />
            </BaseSelect.ScrollUpArrow>
            <BaseSelect.List className="max-h-(--available-height) overflow-y-auto overscroll-contain scroll-py-6">
              {flat.length === 0 && (
                <div className="px-3 py-2 text-sm text-(--faint) select-none">
                  Nessuna voce disponibile
                </div>
              )}
              {isGrouped(options)
                ? options.map((g, i) => (
                    <BaseSelect.Group key={g.label || i} className="[&+&]:mt-1 [&+&]:border-t [&+&]:border-(--border) [&+&]:pt-1">
                      {g.label && (
                        <BaseSelect.GroupLabel className="px-2 pt-1.5 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-(--faint)">
                          {g.label}
                        </BaseSelect.GroupLabel>
                      )}
                      {g.options.map((o) => <Item key={o.value} option={o} />)}
                    </BaseSelect.Group>
                  ))
                : options.map((o) => <Item key={o.value} option={o} />)}
            </BaseSelect.List>
            <BaseSelect.ScrollDownArrow className={SCROLL_ARROW + ' bottom-0 rounded-b-xl'}>
              <ChevronDown className="size-3.5" />
            </BaseSelect.ScrollDownArrow>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  )
}
