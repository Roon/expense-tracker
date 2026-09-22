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
    jest.spyOn(globalThis, 'Date').mockImplementation((...args: unknown[]) => {
      if (args.length === 0) return new RealDate('2024-02-28')
      return new RealDate(...(args as ConstructorParameters<typeof Date>))
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

  it('filters expenses for "week" (last 7 days)', () => {
    const RealDate = globalThis.Date
    jest.spyOn(globalThis, 'Date').mockImplementation((...args: unknown[]) => {
      if (args.length === 0) return new RealDate('2024-03-15')
      return new RealDate(...(args as ConstructorParameters<typeof Date>))
    })

    const expenses: Expense[] = [
      { id: '1', date: '2024-03-07', amount: 50, category: 'Food', description: 'Before range' },
      { id: '2', date: '2024-03-08', amount: 100, category: 'Bills', description: 'In range' },
      { id: '3', date: '2024-03-10', amount: 30, category: 'Food', description: 'In range' },
      { id: '4', date: '2024-03-15', amount: 75, category: 'Transportation', description: 'Today' },
    ]

    const result = filterExpensesByDateRange(expenses, 'week')
    expect(result).toHaveLength(3)
    expect(result.map(e => e.id)).toEqual(['2', '3', '4'])

    jest.restoreAllMocks()
  })

  it('filters expenses for "month" (1st to today)', () => {
    const RealDate = globalThis.Date
    jest.spyOn(globalThis, 'Date').mockImplementation((...args: unknown[]) => {
      if (args.length === 0) return new RealDate('2024-03-15')
      return new RealDate(...(args as ConstructorParameters<typeof Date>))
    })

    const expenses: Expense[] = [
      { id: '1', date: '2024-02-28', amount: 50, category: 'Food', description: 'Before month' },
      { id: '2', date: '2024-03-01', amount: 100, category: 'Bills', description: 'First of month' },
      { id: '3', date: '2024-03-05', amount: 30, category: 'Food', description: 'In month' },
      { id: '4', date: '2024-03-15', amount: 75, category: 'Transportation', description: 'Today' },
    ]

    const result = filterExpensesByDateRange(expenses, 'month')
    expect(result).toHaveLength(3)
    expect(result.map(e => e.id)).toEqual(['2', '3', '4'])

    jest.restoreAllMocks()
  })

  it('filters expenses for "quarter" (3 months)', () => {
    const RealDate = globalThis.Date
    jest.spyOn(globalThis, 'Date').mockImplementation((...args: unknown[]) => {
      if (args.length === 0) return new RealDate('2024-03-15')
      return new RealDate(...(args as ConstructorParameters<typeof Date>))
    })

    const expenses: Expense[] = [
      { id: '1', date: '2023-12-31', amount: 50, category: 'Food', description: 'Before quarter' },
      { id: '2', date: '2024-01-01', amount: 100, category: 'Bills', description: 'Start of quarter' },
      { id: '3', date: '2024-01-15', amount: 30, category: 'Food', description: 'In quarter' },
      { id: '4', date: '2024-02-20', amount: 40, category: 'Transportation', description: 'In quarter' },
      { id: '5', date: '2024-03-15', amount: 75, category: 'Transportation', description: 'Today' },
    ]

    const result = filterExpensesByDateRange(expenses, 'quarter')
    expect(result).toHaveLength(4)
    expect(result.map(e => e.id)).toEqual(['2', '3', '4', '5'])

    jest.restoreAllMocks()
  })
})
