'use client'

import { useActionState, useTransition, useState, useRef } from 'react'
import {
  createCategoryRuleAction,
  deleteCategoryRuleAction,
  previewCategoriesAction, applyCategoriesAction,
  previewCategoryRuleAction,
} from './actions'
import {
  Button, TableWrapper, Table, TableHead, TableBody, Th, Tr, Td, Badge, Select, ConfirmDialog,
} from '@/components/ui'
import { Plus, Trash2, RefreshCw, Tag, Euro } from 'lucide-react'
import type { CategoryProposal } from '@/lib/categorization'
import { formatMoney } from '@/lib/money'
import type { CategoryRuleRow, RulePreview } from '@/lib/merchants'

function fmtAmount(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', { style: 'currency', useGrouping: 'always', currency: 'EUR' })
}

function AmountFilter({ min, max }: { min: number | null; max: number | null }) {
  if (min === null && max === null) return <span className="text-(--faint) text-xs">qualsiasi</span>
  if (min !== null && max !== null)
    return <span className="text-xs text-(--muted)">{fmtAmount(min)} – {fmtAmount(max)}</span>
  if (min !== null)
    return <span className="text-xs text-(--muted)">≥ {fmtAmount(min)}</span>
  return <span className="text-xs text-(--muted)">≤ {fmtAmount(max!)}</span>
}

interface Category { id: number; name: string; kind: string }

interface Props {
  rules:      CategoryRuleRow[]
  categories: Category[]
  accounts:   { id: number; name: string }[]
}

function Conditions({ rule }: { rule: CategoryRuleRow }) {
  const parts = [
    rule.account_name ? `solo ${rule.account_name}` : null,
    rule.direction === 'out' ? 'solo uscite' : rule.direction === 'in' ? 'solo entrate' : null,
  ].filter(Boolean)
  return parts.length
    ? <span className="text-xs text-(--muted)">{parts.join(' · ')}</span>
    : <span className="text-(--faint) text-xs">tutti i movimenti</span>
}

function RulePreviewBox({ preview }: { preview: RulePreview }) {
  if (preview.matches === 0) {
    return <p className="text-sm text-(--muted)">Nessun movimento già importato soddisfa queste condizioni.</p>
  }
  return (
    <div className="rounded-xl border border-(--border) bg-(--surface-2) p-3 space-y-2 text-sm">
      <p className="text-(--ink)">
        Corrisponde a <strong>{preview.matches}</strong> {preview.matches === 1 ? 'movimento' : 'movimenti'}
        {preview.wouldChange > 0 && <>; <strong>{preview.wouldChange}</strong> oggi {preview.wouldChange === 1 ? 'ha' : 'hanno'} un&apos;altra categoria</>}
        {preview.manualKept > 0 && <>; {preview.manualKept} {preview.manualKept === 1 ? 'scelta manuale resta' : 'scelte manuali restano'} com&apos;è</>}.
      </p>
      <ul className="space-y-1 text-xs text-(--muted)">
        {preview.samples.map((s, i) => (
          <li key={i} className="flex gap-2 min-w-0">
            <span className="tabular-nums shrink-0">{s.date}</span>
            <span className="truncate">{s.description}</span>
            <span className="shrink-0 font-mono tabular-nums text-(--ink)">{formatMoney(s.amountMinor, s.currency)}</span>
            <span className="shrink-0">{s.current ?? 'senza categoria'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RuleRow({ rule }: { rule: CategoryRuleRow }) {
  return (
    <Tr>
      <Td className="whitespace-normal">
        <code className="break-all text-xs bg-(--surface-2) border border-(--border) rounded px-1.5 py-0.5 text-(--ink) font-mono">
          {rule.pattern}
        </code>
      </Td>
      <Td>
        <AmountFilter min={rule.amount_minor_min} max={rule.amount_minor_max} />
      </Td>
      <Td className="whitespace-normal min-w-32">
        <Conditions rule={rule} />
      </Td>
      <Td className="whitespace-normal">
        <Badge variant="neutral">{rule.category_name}</Badge>
      </Td>
      <Td>
        <ConfirmDialog
          title={`Eliminare la regola “${rule.pattern}”?`}
          description="I movimenti già categorizzati restano come sono; i prossimi import non useranno più questa regola."
          onConfirm={() => deleteCategoryRuleAction(rule.id)}
          trigger={
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Elimina regola "${rule.pattern}"`}
              className="hover:text-(--danger-text) hover:bg-(--danger-subtle)"
            >
              <Trash2 className="size-3.5" />
            </Button>
          }
        />
      </Td>
    </Tr>
  )
}

function RecategorizeButton() {
  const [pending, start] = useTransition()
  const [preview, setPreview] = useState<{ proposals: CategoryProposal[]; total: number } | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [message, setMessage] = useState('')
  function load() {
    start(async () => {
      try {
        const result = await previewCategoriesAction()
        setPreview(result); setSelected(new Set(result.proposals.map(p => p.id))); setMessage('')
      } catch { setMessage('Impossibile caricare la revisione. Riprova.') }
    })
  }
  return <div className="space-y-3">
    <Button variant="secondary" size="sm" disabled={pending} loading={pending} onClick={load}>
      <RefreshCw className="size-3.5" /> Rivedi categorie dello storico
    </Button>
    <p className="text-xs text-(--muted)">Le scelte manuali, inclusa la rimozione della categoria, sono protette. Le assegnazioni precedenti senza provenienza sono indicate come storiche.</p>
    {preview && <div className="space-y-3">
      <p className="text-sm">{preview.total} modifiche proposte. {preview.total > 500 && 'Visualizzate le prime 500; ripeti la revisione per le successive.'}</p>
      <div className="max-h-80 overflow-auto space-y-2">
        {preview.proposals.map(p => <label key={p.id} className="flex gap-3 rounded-lg border border-(--border) p-3 text-sm">
          <input type="checkbox" checked={selected.has(p.id)} disabled={pending} onChange={e => {
            const next = new Set(selected); if (e.target.checked) next.add(p.id); else next.delete(p.id); setSelected(next)
          }} />
          <span><span className="block">{p.date} · {p.description} · {formatMoney(p.amountMinor, p.currency)}</span>
            <span className="text-(--muted)">{p.before ?? 'Senza categoria'} → {p.after ?? 'Senza categoria'} · {p.source === 'rule' ? 'Regola' : p.source === 'learned' ? `Dallo storico · confidenza ${Math.round((p.confidence ?? 0) * 100)}%` : 'Automatica'}</span>
          </span>
        </label>)}
      </div>
      {selected.size > 0 && <Button size="sm" disabled={pending} loading={pending} onClick={() => start(async () => {
        try {
          const result = await applyCategoriesAction(preview.proposals.filter(p => selected.has(p.id)).map(({ id, fingerprint }) => ({ id, fingerprint })))
          setMessage(`${result.updated} movimenti aggiornati. ${result.skipped ? `${result.skipped} modificati nel frattempo: ricarica la revisione.` : ''}`)
          setPreview(null)
        } catch { setMessage('Applicazione non riuscita. Ricarica la revisione.') }
      })}>Applica {selected.size} modifiche selezionate</Button>}
    </div>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>
}

export default function CategoryRulesManager({ rules, categories, accounts }: Props) {
  const [createState, createAction, isCreating] = useActionState(createCategoryRuleAction, undefined)
  const formRef = useRef<HTMLFormElement>(null)
  const [previewing, startPreview] = useTransition()
  const [rulePreview, setRulePreview] = useState<RulePreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  function runPreview() {
    if (!formRef.current) return
    const data = new FormData(formRef.current)
    startPreview(async () => {
      const result = await previewCategoryRuleAction(data).catch(() => ({ error: 'Anteprima non riuscita. Riprova.' }))
      if ('error' in result) { setPreviewError(result.error); setRulePreview(null) }
      else { setPreviewError(null); setRulePreview(result) }
    })
  }

  const expenseCategories = categories.filter((c) => c.kind === 'expense')
  const incomeCategories  = categories.filter((c) => c.kind === 'income')
  const otherCategories   = categories.filter((c) => c.kind !== 'expense' && c.kind !== 'income')

  return (
    <div className="space-y-6">
      {/* Spiegazione */}
      <p className="text-sm text-(--muted) leading-relaxed">
        Condizioni facoltative: importo, conto, solo entrate o solo uscite. A parità di
        priorità vince la regola più specifica. Prova una regola con «Anteprima» prima di
        aggiungerla; per i movimenti già importati usa la revisione qui sotto.
      </p>

      {/* Tabella regole */}
      {rules.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-(--border) p-4 text-(--muted)">
          <Tag className="size-4 shrink-0" />
          <p className="text-sm">Nessuna regola ancora. Creane una qui sotto.</p>
        </div>
      ) : (
        <TableWrapper className="rounded-xl border border-(--border) overflow-hidden">
          <Table>
            <TableHead>
              <Tr>
                <Th>Parola chiave</Th>
                <Th>Importo</Th>
                <Th>Condizioni</Th>
                <Th>Categoria</Th>
                <Th />
              </Tr>
            </TableHead>
            <TableBody>
              {rules.map((r) => (
                <RuleRow key={r.id} rule={r} />
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}

      {/* Form nuova regola */}
      <form ref={formRef} action={createAction} onChange={() => setRulePreview(null)} className="space-y-3">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-40 space-y-1">
            <label htmlFor="rule-pattern" className="text-xs font-medium text-(--muted)">
              Parola chiave
            </label>
            <input
              id="rule-pattern"
              name="pattern"
              type="text"
              required
              maxLength={200}
              placeholder="es. netflix, apple, abbonamento…"
              className="w-full h-9 rounded-lg border border-(--border) bg-(--surface-2) px-3 text-sm text-(--ink) placeholder:text-(--faint) focus:outline-none focus:ring-2 focus:ring-(--ring) focus:border-(--brand) transition-colors duration-150"
            />
          </div>

          {/* Filtro importo opzionale */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-(--muted) flex items-center gap-1">
              <Euro className="size-3" />
              Da (opz.)
            </label>
            <input
              name="amount_min"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              className="w-24 h-9 rounded-lg border border-(--border) bg-(--surface-2) px-3 text-sm text-(--ink) placeholder:text-(--faint) focus:outline-none focus:ring-2 focus:ring-(--ring) focus:border-(--brand) transition-colors duration-150"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-(--muted) flex items-center gap-1">
              <Euro className="size-3" />
              A (opz.)
            </label>
            <input
              name="amount_max"
              type="text"
              inputMode="decimal"
              placeholder="9,99"
              className="w-24 h-9 rounded-lg border border-(--border) bg-(--surface-2) px-3 text-sm text-(--ink) placeholder:text-(--faint) focus:outline-none focus:ring-2 focus:ring-(--ring) focus:border-(--brand) transition-colors duration-150"
            />
          </div>

          <div className="min-w-40 space-y-1">
            <label htmlFor="rule-category" className="text-xs font-medium text-(--muted)">
              Categoria
            </label>
            <Select
              id="rule-category"
              name="category_id"
              required
              placeholder="Scegli…"
              onValueChange={() => setRulePreview(null)}
              options={[
                { label: 'Uscite',  options: expenseCategories.map((c) => ({ value: String(c.id), label: c.name })) },
                { label: 'Entrate', options: incomeCategories.map((c) => ({ value: String(c.id), label: c.name })) },
                { label: 'Altro',   options: otherCategories.map((c) => ({ value: String(c.id), label: c.name })) },
              ].filter((g) => g.options.length > 0)}
            />
          </div>

          <div className="space-y-1 min-w-0 max-w-full">
            <label htmlFor="rule-account" className="block text-xs font-medium text-(--muted)">Conto</label>
            <Select
              id="rule-account"
              name="bank_account_id"
              defaultValue=""
              className="max-w-64"
              onValueChange={() => setRulePreview(null)}
              options={[{ value: '', label: 'Tutti i conti' }, ...accounts.map((a) => ({ value: String(a.id), label: a.name }))]}
            />
          </div>
          <div className="space-y-1 min-w-0 max-w-full">
            <label htmlFor="rule-direction" className="block text-xs font-medium text-(--muted)">Movimenti</label>
            <Select
              id="rule-direction"
              name="direction"
              defaultValue=""
              className="w-auto"
              onValueChange={() => setRulePreview(null)}
              options={[
                { value: '',    label: 'Entrate e uscite' },
                { value: 'out', label: 'Solo uscite' },
                { value: 'in',  label: 'Solo entrate' },
              ]}
            />
          </div>

          <Button type="button" variant="secondary" size="sm" loading={previewing} disabled={previewing} onClick={runPreview}>
            Anteprima
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={isCreating} disabled={isCreating}>
            <Plus className="size-3.5" />
            Aggiungi
          </Button>
        </div>

        {previewError && <p className="text-sm text-(--danger)">{previewError}</p>}
        {rulePreview && <RulePreviewBox preview={rulePreview} />}

        <p className="text-xs text-(--faint)">
          I campi importo filtrano sull&apos;importo assoluto del movimento (es. Da 0 A 5 cattura
          pagamenti fino a €5). Lasciali vuoti per applicare la regola a qualsiasi importo.
        </p>
      </form>

      {createState?.error   && <p className="text-sm text-(--danger)">{createState.error}</p>}
      {createState?.success && <p className="text-sm text-(--brand-text)">{createState.success}</p>}

      {/* Ricategorizza storico */}
      <div className="pt-4 border-t border-(--border) space-y-2">
        <p className="text-xs text-(--muted)">
          Applica le regole attuali a tutti i movimenti già importati.
        </p>
        <RecategorizeButton />
      </div>
    </div>
  )
}
