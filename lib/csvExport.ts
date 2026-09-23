import type { Expense } from './types'
import { formatDate } from './utils'

function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function generateCSV(expenses: Expense[]): string {
  const header = 'Date,Category,Amount,Description'
  const rows = expenses.map((e) =>
    [
      formatDate(e.date),
      e.category,
      e.amount.toFixed(2),
      escapeCSVField(e.description),
    ].join(','),
  )
  return [header, ...rows].join('\n')
}

export function downloadCSV(expenses: Expense[], filename = 'expenses.csv'): void {
  const csv = generateCSV(expenses)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
