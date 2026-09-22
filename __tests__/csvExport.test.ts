import { generateCSV } from '@/lib/csvExport'
import type { Expense } from '@/lib/types'

const EXPENSES: Expense[] = [
  { id: '1', date: '2024-01-15', amount: 25.5, category: 'Food', description: 'Lunch' },
  { id: '2', date: '2024-01-10', amount: 80, category: 'Bills', description: 'Gas, electric' },
  { id: '3', date: '2024-01-05', amount: 9.99, category: 'Entertainment', description: 'He said "nice"' },
]

describe('generateCSV', () => {
  it('includes a header row', () => {
    const csv = generateCSV(EXPENSES)
    expect(csv.split('\n')[0]).toBe('Date,Description,Category,Amount')
  })

  it('outputs one row per expense', () => {
    const csv = generateCSV(EXPENSES)
    const lines = csv.split('\n')
    expect(lines).toHaveLength(4) // 1 header + 3 rows
  })

  it('formats amount with 2 decimal places', () => {
    const csv = generateCSV(EXPENSES)
    expect(csv).toContain('25.50')
    expect(csv).toContain('80.00')
    expect(csv).toContain('9.99')
  })

  it('wraps descriptions containing commas in double quotes', () => {
    const csv = generateCSV(EXPENSES)
    expect(csv).toContain('"Gas, electric"')
  })

  it('escapes double quotes inside descriptions', () => {
    const csv = generateCSV(EXPENSES)
    expect(csv).toContain('"He said ""nice"""')
  })

  it('returns empty string with header only for empty input', () => {
    const csv = generateCSV([])
    expect(csv).toBe('Date,Description,Category,Amount')
  })
})
