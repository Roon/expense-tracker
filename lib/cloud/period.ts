// lib/cloud/period.ts
import type { Expense } from '@/lib/types'
import type { Frequency, Period, TemplateId } from './types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function periodLabel(p: Period): string {
  if (p.kind === 'all') return 'All time'
  if (p.kind === 'year') return String(p.year)
  return `${MONTHS_LONG[p.month]} ${p.year}`
}

export function shortMonth(month: number): string {
  return MONTHS[month]
}

/** Period slug for filenames, e.g. "2026-09", "2026", "all-time". */
export function periodSlug(p: Period): string {
  if (p.kind === 'all') return 'all-time'
  if (p.kind === 'year') return String(p.year)
  return `${p.year}-${String(p.month + 1).padStart(2, '0')}`
}

export function inPeriod(date: string, p: Period): boolean {
  if (p.kind === 'all') return true
  const [y, m] = date.split('-').map(Number)
  if (p.kind === 'year') return y === p.year
  return y === p.year && m - 1 === p.month
}

export function filterByPeriod(expenses: Expense[], p: Period): Expense[] {
  return expenses.filter((e) => inPeriod(e.date, p))
}

export function previousMonth(p: { year: number; month: number }): { kind: 'month'; year: number; month: number } {
  return p.month === 0
    ? { kind: 'month', year: p.year - 1, month: 11 }
    : { kind: 'month', year: p.year, month: p.month - 1 }
}

export function currentMonth(now: Date = new Date()): Period {
  return { kind: 'month', year: now.getFullYear(), month: now.getMonth() }
}

/**
 * The period a *scheduled* run should cover. A monthly summary sent on the 1st
 * reports on the month that just ended; daily/weekly runs report month-to-date.
 */
export function relativePeriod(template: TemplateId, frequency: Frequency, now: Date = new Date()): Period {
  switch (template) {
    case 'full-backup':
      return { kind: 'all' }
    case 'tax-report':
      return { kind: 'year', year: now.getFullYear() }
    case 'monthly-summary':
    case 'category-analysis': {
      const cur = { year: now.getFullYear(), month: now.getMonth() }
      return frequency === 'monthly' ? previousMonth(cur) : { kind: 'month', ...cur }
    }
  }
}
