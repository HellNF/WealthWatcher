'use client'
import { useState, useTransition } from 'react'
import { previewImportAction, commitImportAction, type PreviewResult, type CommitResult } from './actions'
import { fromMinor } from '@/lib/money'

type Step =
  | { kind: 'pick' }
  | { kind: 'preview'; result: PreviewResult; file: File }
  | { kind: 'done'; result: CommitResult }

const STATUS_BADGE: Record<string, string> = {
  new:       'bg-emerald-950 text-emerald-400',
  duplicate: 'bg-zinc-800 text-zinc-500',
  suspect:   'bg-amber-950 text-amber-400',
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

function formatAmount(minor: number, currency: string): string {
  return fromMinor(minor, currency)
}

export default function ImportForm({ accountId }: { accountId: number }) {
  const [step, setStep]         = useState<Step>({ kind: 'pick' })
  const [isPending, startTransition] = useTransition()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setStep({ kind: 'pick' })
    // reset if new file chosen after a preview
    const file = e.target.files?.[0]
    if (!file) return
    // store nothing yet — user must click preview
  }

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

  // ── Step: pick file ────────────────────────────────────────────────────────
  if (step.kind === 'pick' || step.kind === 'preview') {
    const preview = step.kind === 'preview' ? step.result : null

    return (
      <div className="space-y-6">
        <form onSubmit={handlePreview} className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <input
            type="file"
            name="file"
            accept=".xlsx,.xls"
            required
            onChange={handleFileChange}
            className="flex-1 text-sm text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 transition"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-zinc-800 text-zinc-200 font-medium px-4 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50 transition whitespace-nowrap"
          >
            {isPending && step.kind === 'pick' ? 'Analisi in corso…' : 'Analizza file'}
          </button>
        </form>

        {preview?.error && (
          <div className="rounded-lg bg-red-950 border border-red-800 text-red-300 px-4 py-3 text-sm">
            {preview.error}
          </div>
        )}

        {preview && !preview.error && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="px-2.5 py-1 rounded-md bg-emerald-950 text-emerald-400">
                {preview.newCount} nuovi
              </span>
              <span className="px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-400">
                {preview.duplicateCount} duplicati
              </span>
              {preview.suspectCount > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-amber-950 text-amber-400">
                  {preview.suspectCount} sospetti
                </span>
              )}
              <span className="text-zinc-600 self-center">
                — {preview.filename}
              </span>
            </div>

            {/* Preview table */}
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950">
                    <th className="text-left px-4 py-2 text-zinc-500 font-medium">Stato</th>
                    <th className="text-left px-4 py-2 text-zinc-500 font-medium">Data</th>
                    <th className="text-left px-4 py-2 text-zinc-500 font-medium">Descrizione</th>
                    <th className="text-left px-4 py-2 text-zinc-500 font-medium">Categoria</th>
                    <th className="text-right px-4 py-2 text-zinc-500 font-medium">Importo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {preview.rows.map((row, i) => (
                    <tr
                      key={i}
                      className={`bg-zinc-900 ${row.status === 'duplicate' ? 'opacity-50' : ''}`}
                    >
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[row.status]}`}>
                          {STATUS_LABEL[row.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400 tabular-nums">
                        {formatDate(row.bookedDate)}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-200 max-w-xs truncate">
                        {row.descriptionRaw}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs">
                        {row.categoryName ?? '—'}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right tabular-nums font-mono text-sm ${
                          row.amountMinor < 0 ? 'text-red-400' : 'text-emerald-400'
                        }`}
                      >
                        {row.amountMinor >= 0 ? '+' : ''}
                        {formatAmount(row.amountMinor, row.currency)} {row.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Confirm */}
            {preview.newCount > 0 ? (
              <button
                onClick={handleCommit}
                disabled={isPending}
                className="rounded-lg bg-emerald-500 text-zinc-950 font-medium px-5 py-2 text-sm hover:bg-emerald-400 disabled:opacity-50 transition"
              >
                {isPending ? 'Importazione in corso…' : `Importa ${preview.newCount} movimenti`}
              </button>
            ) : (
              <p className="text-sm text-zinc-500">
                Nessun movimento nuovo da importare.
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Step: done ─────────────────────────────────────────────────────────────
  const { result } = step

  return (
    <div className="space-y-4">
      {result.error ? (
        <div className="rounded-lg bg-red-950 border border-red-800 text-red-300 px-4 py-3 text-sm">
          {result.error}
        </div>
      ) : (
        <div className="rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-300 px-4 py-3 text-sm space-y-1">
          <p className="font-semibold">Importazione completata</p>
          <p>{result.insertedCount} movimenti inseriti · {result.duplicateCount} duplicati ignorati</p>
        </div>
      )}
      <div className="flex gap-3">
        <a
          href={`/dashboard/accounts/${accountId}`}
          className="rounded-lg bg-zinc-800 text-zinc-200 px-4 py-2 text-sm hover:bg-zinc-700 transition"
        >
          Torna al conto
        </a>
        <button
          onClick={() => setStep({ kind: 'pick' })}
          className="rounded-lg border border-zinc-700 text-zinc-400 px-4 py-2 text-sm hover:border-zinc-500 hover:text-zinc-200 transition"
        >
          Importa un altro file
        </button>
      </div>
    </div>
  )
}
