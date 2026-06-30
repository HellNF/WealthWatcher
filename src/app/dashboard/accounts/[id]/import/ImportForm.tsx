'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  previewImportAction,
  commitImportAction,
  type PreviewResult,
  type CommitResult,
} from './actions'
import { fromMinor } from '@/lib/money'
import {
  Button, Badge,
  TableWrapper, Table, TableHead, TableBody, Th, Tr, Td,
  Card,
} from '@/components/ui'
import { Upload, CheckCircle2, AlertCircle } from 'lucide-react'

type Step =
  | { kind: 'pick' }
  | { kind: 'preview'; result: PreviewResult; file: File }
  | { kind: 'done'; result: CommitResult }

const STATUS_VARIANT: Record<string, 'success' | 'neutral' | 'warning'> = {
  new:       'success',
  duplicate: 'neutral',
  suspect:   'warning',
}
const STATUS_LABEL: Record<string, string> = {
  new:       'Nuovo',
  duplicate: 'Duplicato',
  suspect:   'Sospetto',
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function ImportForm({ accountId }: { accountId: number }) {
  const [step, setStep] = useState<Step>({ kind: 'pick' })
  const [isPending, startTransition] = useTransition()

  function handlePreview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const file = (form.elements.namedItem('file') as HTMLInputElement).files?.[0]
    if (!file) return

    const fd = new FormData()
    fd.append('file', file)
    fd.append('accountId', String(accountId))

    startTransition(async () => {
      const result = await previewImportAction(fd)
      setStep({ kind: 'preview', result, file })
    })
  }

  function handleCommit() {
    if (step.kind !== 'preview') return
    const { file } = step

    const fd = new FormData()
    fd.append('file', file)
    fd.append('accountId', String(accountId))

    startTransition(async () => {
      const result = await commitImportAction(fd)
      setStep({ kind: 'done', result })
    })
  }

  /* ── Step: pick + preview ─────────────────────────────────────────────── */
  if (step.kind === 'pick' || step.kind === 'preview') {
    const preview = step.kind === 'preview' ? step.result : null

    return (
      <div className="space-y-6">
        {/* File picker */}
        <Card>
          <form onSubmit={handlePreview} className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium text-[--ink]">
                File Excel (.xlsx)
              </label>
              <div className="relative">
                <input
                  type="file"
                  name="file"
                  accept=".xlsx,.xls"
                  required
                  onChange={() => setStep({ kind: 'pick' })}
                  className="w-full text-sm text-[--muted]
                    file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0
                    file:text-sm file:font-medium file:cursor-pointer
                    file:bg-[--surface-2] file:text-[--ink]
                    hover:file:bg-[--border]
                    transition-colors"
                />
              </div>
            </div>
            <Button
              type="submit"
              variant="secondary"
              loading={isPending && step.kind === 'pick'}
              className="shrink-0 self-end"
            >
              <Upload className="size-4" />
              Analizza file
            </Button>
          </form>
        </Card>

        {/* Error */}
        {preview?.error && (
          <div className="flex items-start gap-3 rounded-xl border border-[--danger]/30 bg-[--danger-subtle] px-4 py-3 text-sm text-[--danger-text]">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            {preview.error}
          </div>
        )}

        {/* Preview result */}
        {preview && !preview.error && (
          <div className="space-y-4">
            {/* Summary badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">{preview.newCount} nuovi</Badge>
              <Badge variant="neutral">{preview.duplicateCount} duplicati</Badge>
              {preview.suspectCount > 0 && (
                <Badge variant="warning">{preview.suspectCount} sospetti</Badge>
              )}
              <span className="text-xs text-[--faint] ml-1">{preview.filename}</span>
            </div>

            {/* Preview table */}
            <TableWrapper className="rounded-xl border border-[--border] overflow-hidden">
              <Table>
                <TableHead>
                  <Tr>
                    <Th>Stato</Th>
                    <Th>Data</Th>
                    <Th>Descrizione</Th>
                    <Th>Categoria</Th>
                    <Th className="text-right">Importo</Th>
                  </Tr>
                </TableHead>
                <TableBody>
                  {preview.rows.map((row, i) => (
                    <Tr
                      key={i}
                      className={row.status === 'duplicate' ? 'opacity-40' : undefined}
                    >
                      <Td>
                        <Badge variant={STATUS_VARIANT[row.status] ?? 'neutral'}>
                          {STATUS_LABEL[row.status]}
                        </Badge>
                      </Td>
                      <Td className="text-[--muted] text-xs tabular-nums">
                        {formatDate(row.bookedDate)}
                      </Td>
                      <Td className="max-w-xs">
                        <span className="truncate block text-[--ink]">
                          {row.descriptionRaw}
                        </span>
                      </Td>
                      <Td className="text-[--muted] text-xs">{row.categoryName ?? '—'}</Td>
                      <Td numeric>
                        <Badge variant={row.amountMinor < 0 ? 'loss' : 'gain'}>
                          {row.amountMinor >= 0 ? '+' : ''}
                          {fromMinor(row.amountMinor, row.currency)} {row.currency}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>

            {/* Confirm or empty */}
            {preview.newCount > 0 ? (
              <Button
                onClick={handleCommit}
                disabled={isPending}
                loading={isPending && step.kind === 'preview'}
              >
                Importa {preview.newCount} movimenti
              </Button>
            ) : (
              <p className="text-sm text-[--muted]">
                Nessun movimento nuovo da importare.
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  /* ── Step: done ──────────────────────────────────────────────────────── */
  const { result } = step

  return (
    <div className="space-y-4">
      {result.error ? (
        <div className="flex items-start gap-3 rounded-xl border border-[--danger]/30 bg-[--danger-subtle] px-4 py-3 text-sm text-[--danger-text]">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          {result.error}
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-[--brand]/30 bg-[--brand-subtle] px-4 py-3 text-sm text-[--brand-text]">
          <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Importazione completata</p>
            <p className="text-[--muted] mt-0.5">
              {result.insertedCount} movimenti inseriti · {result.duplicateCount} duplicati ignorati
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Link
          href={`/dashboard/accounts/${accountId}`}
          className="inline-flex items-center justify-center h-9 px-4 text-sm font-medium rounded-lg border border-[--border] text-[--ink] hover:bg-[--surface-2] transition-all duration-150"
        >
          Torna al conto
        </Link>
        <Button variant="ghost" onClick={() => setStep({ kind: 'pick' })}>
          Importa un altro file
        </Button>
      </div>
    </div>
  )
}
