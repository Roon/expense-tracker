// lib/utils.ts
import type { Expense } from './types'

export type DateRange = 'week' | 'month' | 'quarter' | 'all'

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

export function filterExpensesByDateRange(
  expenses: Expense[],
  range: DateRange,
): Expense[] {
  if (range === 'all') return expenses

  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)

  if (range === 'week') {
    start.setDate(start.getDate() - 6)
  } else if (range === 'month') {
    start.setDate(1)
  } else if (range === 'quarter') {
    start.setMonth(start.getMonth() - 2)
    start.setDate(1)
  }

  return expenses.filter((e) => {
    const [y, m, d] = e.date.split('-').map(Number)
    return new Date(y, m - 1, d) >= start
  })
}

export function getMonthlyTotals(
  expenses: Expense[],
  months: number,
): { month: string; total: number }[] {
  const now = new Date()
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    const year = d.getFullYear()
    const month = d.getMonth()
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    const total = expenses
      .filter((e) => {
        const [ey, em] = e.date.split('-').map(Number)
        return ey === year && em - 1 === month
      })
      .reduce((sum, e) => sum + e.amount, 0)
    return { month: label, total }
  })
}
