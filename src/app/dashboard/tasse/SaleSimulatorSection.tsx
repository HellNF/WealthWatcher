'use client'

import { useState } from 'react'
import { Field, Select } from '@/components/ui'
import TaxSimulator from './TaxSimulator'

interface InstrumentOption {
  instrumentId:  number
  symbol:        string
  name:          string
  remainingQty:  string
  lastPrice:     string | null
  currency:      string
}

interface PortfolioOption {
  portfolioId:   number
  portfolioName: string
  instruments:   InstrumentOption[]
}

interface Props {
  portfolios: PortfolioOption[]
}

/**
 * Simulatore di vendita consolidato nella pagina Tasse.
 * Aggiunge un selettore di portafoglio al TaxSimulator, che mostra gli strumenti
 * del portafoglio scelto.
 */
export default function SaleSimulatorSection({ portfolios }: Props) {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number>(
    portfolios[0]?.portfolioId ?? 0,
  )

  const selectedPortfolio = portfolios.find(p => p.portfolioId === selectedPortfolioId)
    ?? portfolios[0]

  if (!selectedPortfolio || selectedPortfolio.instruments.length === 0) {
    return (
      <p className="text-sm text-[--muted]">
        Nessuna posizione aperta disponibile per la simulazione.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {portfolios.length > 1 && (
        <Field label="Portafoglio" htmlFor="sim-portfolio" className="max-w-xs">
          <Select
            id="sim-portfolio"
            value={selectedPortfolioId}
            onChange={e => setSelectedPortfolioId(Number(e.target.value))}
          >
            {portfolios.map(p => (
              <option key={p.portfolioId} value={p.portfolioId}>
                {p.portfolioName}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <TaxSimulator
        portfolioId={selectedPortfolio.portfolioId}
        instruments={selectedPortfolio.instruments}
      />
    </div>
  )
}
