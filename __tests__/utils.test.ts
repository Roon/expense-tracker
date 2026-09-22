// __tests__/utils.test.ts
import { formatCurrency, formatDate, getTodayString, getMonthlyTotals, filterExpensesByDateRange } from '@/lib/utils'
import type { Expense } from '@/lib/types'

describe('formatCurrency', () => {
  it('formats whole dollars', () => {
    expect(formatCurrency(100)).toBe('$100.00')
  })
  it('formats cents', () => {
    expect(formatCurrency(9.99)).toBe('$9.99')
  })
  it('formats thousands with comma', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56')
  })
})

describe('formatDate', () => {
  it('formats ISO date string to readable form', () => {
    expect(formatDate('2024-01-15')).toBe('Jan 15, 2024')
  })
  it('formats month boundaries correctly', () => {
    expect(formatDate('2024-12-31')).toBe('Dec 31, 2024')
  })
})

describe('getTodayString', () => {
  it('returns YYYY-MM-DD format', () => {
    expect(getTodayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

const SAMPLE_EXPENSES: Expense[] = [
  { id: '1', date: '2024-01-10', amount: 50, category: 'Food', description: 'Lunch' },
  { id: '2', date: '2024-01-20', amount: 100, category: 'Bills', description: 'Internet' },
  { id: '3', date: '2024-02-05', amount: 30, category: 'Food', description: 'Coffee' },
]

describe('getMonthlyTotals', () => {
  it('returns an array with the requested number of months', () => {
    const result = getMonthlyTotals([], 6)
    expect(result).toHaveLength(6)
  })
  it('sums amounts for each month correctly', () => {
    // We test with known past data by mocking Date
    const RealDate = globalThis.Date
    jest.spyOn(globalThis, 'Date').mockImplementation((...args) => {
      if (args.length === 0) return new RealDate('2024-02-28')
      // @ts-expect-error — spread on overloaded constructor
      return new RealDate(...args)
    })
    const result = getMonthlyTotals(SAMPLE_EXPENSES, 2)
    const janEntry = result.find(r => r.month.startsWith('Jan'))
    const febEntry = result.find(r => r.month.startsWith('Feb'))
    expect(janEntry?.total).toBe(150)
    expect(febEntry?.total).toBe(30)
    jest.restoreAllMocks()
  })
})

describe('filterExpensesByDateRange', () => {
  it('returns all expenses for "all"', () => {
    const result = filterExpensesByDateRange(SAMPLE_EXPENSES, 'all')
    expect(result).toHaveLength(3)
  })
})
