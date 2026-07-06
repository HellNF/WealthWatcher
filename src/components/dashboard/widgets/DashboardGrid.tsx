'use client'

import { useState, useTransition } from 'react'
import { Reorder, motion, AnimatePresence, useDragControls } from 'motion/react'
import { Settings2, Plus, Check } from 'lucide-react'
import { saveDashboardLayoutAction } from '@/app/dashboard/actions'
import type { WidgetConfig, WidgetSize } from '@/lib/userSettings'
import { WidgetShell } from './WidgetShell'
import { GoalsWidget }       from './GoalsWidget'
import { BudgetWidget }      from './BudgetWidget'
import { InvestmentsWidget } from './InvestmentsWidget'
import { DeadlinesWidget }   from './DeadlinesWidget'
import { NewsWidget }        from './NewsWidget'
import type { DashboardWidgetsData, WidgetId } from './types'

// ── Metadati statici ───────────────────────────────────────────────────────────

const ALL_WIDGET_IDS: WidgetId[] = ['investments', 'goals', 'budget', 'deadlines', 'news']

const WIDGET_META: Record<WidgetId, { title: string; href?: string }> = {
  investments: { title: 'Investimenti' },
  goals:       { title: 'Obiettivi',         href: '/dashboard/obiettivi' },
  budget:      { title: 'Budget del mese',   href: '/dashboard/budgets' },
  deadlines:   { title: 'Prossime scadenze', href: '/dashboard/scadenziario' },
  news:        { title: 'Notizie di mercato' },
}

// Classi per ogni dimensione:
//   col-span  → larghezza nella griglia a 6 colonne
//   md:h-*    → altezza fissa su desktop (allinea widget affiancati)
// Mobile: sempre full-width, altezza auto.
// SM e MD hanno la stessa altezza fissa (320px) così rimangono allineati
// quando affiancati nella stessa riga. LG ha altezza libera (tutta la riga).
const ITEM_CLASS: Record<WidgetSize, string> = {
  sm: 'col-span-6 md:col-span-2 md:h-96',
  md: 'col-span-6 md:col-span-3 md:h-96',
  lg: 'col-span-6',
}

// ── Singolo widget draggabile ─────────────────────────────────────────────────

interface DraggableWidgetProps {
  id:        WidgetId
  isEditing: boolean
  size:      WidgetSize
  onHide:    () => void
  onResize:  (s: WidgetSize) => void
  data:      DashboardWidgetsData
}

function DraggableWidget({ id, isEditing, size, onHide, onResize, data }: DraggableWidgetProps) {
  const controls = useDragControls()
  const meta = WIDGET_META[id]

  return (
    <Reorder.Item
      value={id}
      dragControls={controls}
      dragListener={false}
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={ITEM_CLASS[size]}
    >
      <WidgetShell
        title={meta.title}
        href={meta.href}
        isEditing={isEditing}
        onHide={onHide}
        onDragStart={(e) => controls.start(e)}
        size={size}
        onResize={onResize}
      >
        {id === 'goals'       && <GoalsWidget       data={data.goals}       size={size} />}
        {id === 'budget'      && <BudgetWidget      data={data.budget}      size={size} />}
        {id === 'investments' && <InvestmentsWidget data={data.investments} size={size} />}
        {id === 'deadlines'   && <DeadlinesWidget   data={data.deadlines}   size={size} />}
        {id === 'news'        && <NewsWidget        data={data.news}        size={size} />}
      </WidgetShell>
    </Reorder.Item>
  )
}

// ── DashboardGrid ─────────────────────────────────────────────────────────────

interface Props {
  data:          DashboardWidgetsData
  initialLayout: WidgetConfig[]
}

export default function DashboardGrid({ data, initialLayout }: Props) {
  const [order, setOrder] = useState<WidgetId[]>(
    initialLayout.filter(w => w.visible).map(w => w.id),
  )
  const [hidden, setHidden] = useState<Set<WidgetId>>(
    new Set(initialLayout.filter(w => !w.visible).map(w => w.id)),
  )
  const [sizes, setSizes] = useState<Record<WidgetId, WidgetSize>>(
    Object.fromEntries(
      initialLayout.map(w => [w.id, w.size ?? 'md']),
    ) as Record<WidgetId, WidgetSize>,
  )
  const [isEditing, setIsEditing]    = useState(false)
  const [isPending, startTransition] = useTransition()

  function hideWidget(id: WidgetId) {
    setOrder(o => o.filter(x => x !== id))
    setHidden(s => new Set([...s, id]))
  }

  function showWidget(id: WidgetId) {
    setHidden(s => { const n = new Set(s); n.delete(id); return n })
    setOrder(o => [...o, id])
  }

  function resizeWidget(id: WidgetId, size: WidgetSize) {
    setSizes(prev => ({ ...prev, [id]: size }))
  }

  function exitEditMode() {
    const layout: WidgetConfig[] = [
      ...order.map(id => ({ id, visible: true  as const, size: sizes[id] ?? 'md' })),
      ...ALL_WIDGET_IDS.filter(id => hidden.has(id)).map(id => ({ id, visible: false as const, size: sizes[id] ?? 'md' })),
    ]
    startTransition(async () => { await saveDashboardLayoutAction(layout) })
    setIsEditing(false)
  }

  return (
    <section className="space-y-4">

      {/* Intestazione */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[--ink]">Panoramica</h2>
        {isEditing ? (
          <button
            onClick={exitEditMode}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[--brand] text-white hover:opacity-90 disabled:opacity-60 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
          >
            <Check className="size-3" strokeWidth={2.5} />
            {isPending ? 'Salvataggio…' : 'Fine'}
          </button>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[--border] bg-[--surface] text-[--muted] hover:text-[--ink] hover:bg-[--surface-2] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
          >
            <Settings2 className="size-3.5" strokeWidth={1.75} />
            Personalizza
          </button>
        )}
      </div>

      {/* Griglia a 6 colonne riordinabile */}
      <Reorder.Group
        as="div"
        axis="y"
        values={order}
        onReorder={setOrder}
        className="grid grid-cols-6 gap-4"
      >
        <AnimatePresence initial={false}>
          {order.map(id => (
            <DraggableWidget
              key={id}
              id={id}
              isEditing={isEditing}
              size={sizes[id] ?? 'md'}
              onHide={() => hideWidget(id)}
              onResize={(s) => resizeWidget(id, s)}
              data={data}
            />
          ))}
        </AnimatePresence>
      </Reorder.Group>

      {/* Pannello widget nascosti */}
      <AnimatePresence>
        {isEditing && hidden.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18 }}
            className="rounded-2xl border border-dashed border-[--border] p-4"
          >
            <p className="text-xs font-medium text-[--muted] mb-3">Widget nascosti</p>
            <div className="flex flex-wrap gap-2">
              {ALL_WIDGET_IDS.filter(id => hidden.has(id)).map(id => (
                <button
                  key={id}
                  onClick={() => showWidget(id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[--border] bg-[--surface] text-[--muted] hover:text-[--brand-text] hover:border-[--brand] hover:bg-[--brand-subtle] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
                >
                  <Plus className="size-3" strokeWidth={2} />
                  {WIDGET_META[id].title}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </section>
  )
}
