'use client'
import { useState, useTransition } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { EtfProfile } from '@/lib/prices/justetf'
import { loadEtfAction } from './etf-actions'
import { Button } from '@/components/ui'
import { formatDateTimeIt } from '@/lib/formatDate'
export default function EtfDetails({ portfolioId, instrumentId, isin, initial }: {
  portfolioId: number; instrumentId: number; isin: string; initial: EtfProfile | null
}) {
  const [profile, setProfile] = useState(initial)
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  return <details className="mt-3 rounded-xl border border-(--border) p-3 text-sm">
    <summary className="cursor-pointer font-medium">Scheda ETF · {isin} · justETF sperimentale</summary>
    <div className="space-y-3 pt-3">
      <p className="text-xs text-(--muted)">Dati informativi separati dalla valutazione del patrimonio. Fonte non contrattualizzata; disponibilità e copertura possono variare. Cache di 24 ore.</p>
      <Button size="sm" variant="secondary" disabled={pending} loading={pending} onClick={() => start(async () => {
        try {
          const result = await loadEtfAction(portfolioId, instrumentId)
          if (result.profile) { setProfile(result.profile); setError('') } else setError(result.error ?? 'Dati non disponibili')
        } catch { setError('Impossibile contattare il servizio. Riprova più tardi.') }
      })}>{profile ? 'Aggiorna scheda' : 'Carica scheda e rendimento'}</Button>
      {error && <p role="status" className="text-(--warning-text)">{error}</p>}
      {profile && <>
        <p className="font-medium">{profile.name}</p>
        <dl className="grid grid-cols-2 gap-2">
          <dt>TER annuo</dt><dd>{profile.terPercent === null ? 'Non disponibile' : `${profile.terPercent.toLocaleString('it-IT')}%`}</dd>
          <dt>Distribuzione</dt><dd>{profile.distribution ?? 'Non verificata'}</dd>
          <dt>Replica</dt><dd>{profile.replication ?? 'Non verificata'}</dd>
        </dl>
        <p className="text-xs text-(--muted)">Fonte: justETF · Acquisito il {formatDateTimeIt(profile.retrievedAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}. Data di revisione dei metadati non fornita.</p>
        <p className="font-medium">Rendimento cumulativo in EUR · dividendi inclusi</p>
        <p className="text-xs text-(--muted)">Dal {profile.performance[0]?.date} al {profile.performance.at(-1)?.date}. Base 0%; valori percentuali, non prezzi. La valuta del grafico non indica la valuta del fondo. I punti includono giorni non di negoziazione.</p>
        <div className="h-52" role="img" aria-label={`Rendimento cumulativo dell'ETF in EUR con dividendi: ${profile.performance.at(-1)?.percent}% a fine periodo`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={profile.performance} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" minTickGap={70} tickFormatter={d => String(d).slice(0, 7)} />
              <YAxis tickFormatter={v => `${v}%`} domain={['auto', 'auto']} />
              <Tooltip formatter={v => [`${Number(v).toLocaleString('it-IT')}%`, 'Rendimento cumulativo']} />
              <Line type="linear" dataKey="percent" stroke="var(--brand)" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </>}
      <a className="text-(--brand-text) underline" href={`https://www.justetf.com/it/etf-profile.html?isin=${encodeURIComponent(isin)}`} target="_blank" rel="noopener noreferrer">Verifica la scheda su justETF</a>
    </div>
  </details>
}
