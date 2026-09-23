// lib/export/filters.ts
import type { Expense } from '@/lib/types'
import type { ExportFilters, ExportSummary } from './types'

/** Returns matching expenses sorted newest first (ties broken by description). */
export function applyExportFilters(expenses: Expense[], filters: ExportFilters): Expense[] {
  const { startDate, endDate, categories } = filters
  const allowed = new Set(categories)
  // Dates are ISO YYYY-MM-DD strings, so lexical comparison is chronological.
  return expenses
    .filter((e) => allowed.has(e.category))
    .filter((e) => !startDate || e.date >= startDate)
    .filter((e) => !endDate || e.date <= endDate)
    .sort((a, b) => b.date.localeCompare(a.date) || a.description.localeCompare(b.description))
}

export function summarizeExpenses(expenses: Expense[]): ExportSummary {
  const summary: ExportSummary = {
    count: expenses.length,
    total: 0,
    firstDate: null,
    lastDate: null,
    byCategory: {},
  }
  for (const e of expenses) {
    summary.total += e.amount
    if (!summary.firstDate || e.date < summary.firstDate) summary.firstDate = e.date
    if (!summary.lastDate || e.date > summary.lastDate) summary.lastDate = e.date
    const bucket = (summary.byCategory[e.category] ??= { count: 0, total: 0 })
    bucket.count += 1
    bucket.total += e.amount
  }
  // Avoid floating-point drift like 0.30000000000000004 in totals.
  summary.total = roundCents(summary.total)
  for (const bucket of Object.values(summary.byCategory)) bucket.total = roundCents(bucket.total)
  return summary
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100
}

export function validateFilters(filters: ExportFilters): string | null {
  if (filters.categories.length === 0) return 'Select at least one category.'
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
    return 'Start date must be on or before end date.'
  }
  return null
}

// ---- Date presets -------------------------------------------------------

export type DatePresetId = 'all' | 'thisMonth' | 'lastMonth' | 'last30' | 'thisYear' | 'custom'

export const DATE_PRESETS: { id: DatePresetId; label: string }[] = [
  { id: 'all', label: 'All time' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'thisYear', label: 'Year to date' },
  { id: 'custom', label: 'Custom' },
]

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Resolves a preset to concrete bounds relative to `now` (local time). */
export function resolveDatePreset(
  id: Exclude<DatePresetId, 'custom'>,
  now: Date = new Date(),
): { startDate: string; endDate: string } {
  const y = now.getFullYear()
  const m = now.getMonth()
  switch (id) {
    case 'all':
      return { startDate: '', endDate: '' }
    case 'thisMonth':
      return { startDate: toISODate(new Date(y, m, 1)), endDate: toISODate(now) }
    case 'lastMonth':
      return { startDate: toISODate(new Date(y, m - 1, 1)), endDate: toISODate(new Date(y, m, 0)) }
    case 'last30':
      return { startDate: toISODate(new Date(y, m, now.getDate() - 29)), endDate: toISODate(now) }
    case 'thisYear':
      return { startDate: toISODate(new Date(y, 0, 1)), endDate: toISODate(now) }
  }
}
