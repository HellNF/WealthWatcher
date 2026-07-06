// Tipi serializzabili passati dal server component ai widget client.
// Tutti i campi devono essere primitivi o array/oggetti di primitivi.

import type { WidgetId, WidgetConfig, WidgetSize } from '@/lib/userSettings'

export type { WidgetId, WidgetConfig, WidgetSize }

// ── Dati per singolo widget ────────────────────────────────────────────────────

export interface GoalItem {
  id:        number
  name:      string
  color:     string
  current:   number   // minor units EUR
  target:    number   // minor units EUR
  completed: boolean
}

export interface GoalsWidgetData {
  goals:   GoalItem[]
  summary: {
    totalCashMinor:         number
    totalAllocatedMinor:    number
    freeOperatingCashMinor: number
  }
}

export interface BudgetWidgetData {
  month:   string   // YYYY-MM
  total: {
    spentMinor: number
    limitMinor: number | null
    pct:        number | null
  }
  topCategories: {
    name:       string | null
    color:      string | null
    spentMinor: number
    limitMinor: number
    pct:        number
  }[]
  daysRemainingInMonth: number
}

export interface SparkPoint {
  date:  string   // YYYY-MM-DD
  value: number   // eurMinor
}

export interface PortfolioItem {
  id:       number
  name:     string
  eurMinor: number | null
  sparkline: SparkPoint[]
}

export interface InvestmentsWidgetData {
  portfolios:            PortfolioItem[]
  totalInvestmentsMinor: number
}

export interface DeadlineItem {
  date:        string
  label:       string
  source:      string
  amountMinor: number
}

export interface DeadlinesWidgetData {
  upcoming: DeadlineItem[]
}

export interface NewsArticle {
  uuid:         string
  title:        string
  publisher:    string
  link:         string
  publishedAt:  number   // unix timestamp (secondi)
  thumbnailUrl?: string
}

export interface NewsWidgetData {
  articles: NewsArticle[]
}

// ── Aggregato completo passato a DashboardGrid ─────────────────────────────────

export interface DashboardWidgetsData {
  goals:       GoalsWidgetData
  budget:      BudgetWidgetData
  investments: InvestmentsWidgetData
  deadlines:   DeadlinesWidgetData
  news:        NewsWidgetData
}
