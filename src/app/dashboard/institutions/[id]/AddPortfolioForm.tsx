'use client'
import { useActionState } from 'react'
import { addPortfolio, type ActionState } from './actions'

export default function AddPortfolioForm({ institutionId }: { institutionId: number }) {
  const boundAction = addPortfolio.bind(null, institutionId)
  const [state, action, pending] = useActionState<ActionState, FormData>(boundAction, undefined)

  return (
    <form action={action} className="flex flex-wrap gap-2 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Nome portafoglio</label>
        <input
          name="name"
          required
          placeholder="es. ETF Accumulo"
          className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100
                     placeholder:text-zinc-600 focus:border-emerald-500 outline-none w-52"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Valuta</label>
        <input
          name="currency"
          defaultValue="EUR"
          maxLength={3}
          required
          className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100
                     placeholder:text-zinc-600 focus:border-emerald-500 outline-none w-24 uppercase"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-800 text-zinc-200 font-medium px-4 py-2 text-sm
                   hover:bg-zinc-700 disabled:opacity-50 transition"
      >
        {pending ? 'Aggiungo…' : '+ Portafoglio'}
      </button>
      {state?.error && (
        <span className="text-sm text-red-400 w-full">{state.error}</span>
      )}
    </form>
  )
}
