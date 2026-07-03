'use server'
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/dal'
import { sqlite } from '@/db'

const SOURCE_MAP: Record<string, string> = {
  yahoo:        'YAHOO',
  coingecko:    'COINGECKO',
  alphavantage: 'MANUAL',
  manual:       'MANUAL',
}

const TYPE_MAP: Record<string, string> = {
  buy:      'BUY',
  sell:     'SELL',
  dividend: 'DIVIDEND',
  fee:      'FEE',
}

export async function GET() {
  let user: Awaited<ReturnType<typeof requireUser>>
  try {
    user = await requireUser()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rows = sqlite.prepare(`
    SELECT
      it.type,
      it.trade_date,
      it.quantity,
      it.unit_price,
      it.fee_minor,
      it.amount_minor,
      it.currency,
      it.note,
      i.symbol,
      i.price_source
    FROM investment_txns it
    JOIN instruments i ON i.id = it.instrument_id
    JOIN investment_portfolios ip ON ip.id = it.portfolio_id
    WHERE ip.owner_id = ?
    ORDER BY it.trade_date ASC, it.id ASC
  `).all(user.id) as Array<{
    type:         string
    trade_date:   string
    quantity:     string | null
    unit_price:   string | null
    fee_minor:    number
    amount_minor: number | null
    currency:     string
    note:         string | null
    symbol:       string
    price_source: string
  }>

  const activities = rows
    .filter(r => TYPE_MAP[r.type])
    .map(r => {
      const isBuySell   = r.type === 'buy' || r.type === 'sell'
      const isDividend  = r.type === 'dividend'
      const quantity    = isBuySell && r.quantity ? parseFloat(r.quantity) : isDividend ? 1 : 1
      const unitPrice   = isBuySell && r.unit_price
        ? parseFloat(r.unit_price)
        : isDividend && r.amount_minor
          ? Math.abs(r.amount_minor) / 100
          : r.amount_minor ? Math.abs(r.amount_minor) / 100 : 0
      const fee = r.fee_minor / 100

      return {
        currency:   r.currency,
        date:       `${r.trade_date}T00:00:00.000Z`,
        dataSource: SOURCE_MAP[r.price_source] ?? 'MANUAL',
        fee:        fee > 0 ? fee : 0,
        quantity,
        symbol:     r.symbol,
        type:       TYPE_MAP[r.type],
        unitPrice,
        comment:    r.note ?? null,
      }
    })

  return NextResponse.json(
    {
      meta: {
        date:    new Date().toISOString(),
        version: 'v1',
      },
      activities,
    },
    {
      headers: {
        'Content-Disposition': 'attachment; filename="ghostfolio-export.json"',
        'Content-Type':        'application/json',
      },
    },
  )
}
