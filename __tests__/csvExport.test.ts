import { generateCSV } from '@/lib/csvExport'
import type { Expense } from '@/lib/types'

const EXPENSES: Expense[] = [
  { id: '1', date: '2024-01-15', amount: 25.5, category: 'Food', description: 'Lunch' },
  { id: '2', date: '2024-01-10', amount: 80, category: 'Bills', description: 'Gas, electric' },
  { id: '3', date: '2024-01-05', amount: 9.99, category: 'Entertainment', description: 'He said "nice"' },
]

// Minimal RFC 4180 parser: splits on commas outside double quotes, unescapes "".
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      fields.push(field)
      field = ''
    } else {
      field += ch
    }
  }
  fields.push(field)
  return fields
}

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

  it('gives every row the same number of fields as the header', () => {
    const lines = generateCSV(EXPENSES).split('\n')
    const width = parseCSVLine(lines[0]).length
    for (const line of lines) expect(parseCSVLine(line)).toHaveLength(width)
  })

  it('keeps the formatted date intact in the Date column', () => {
    const row = parseCSVLine(generateCSV(EXPENSES).split('\n')[1])
    expect(row).toEqual(['Jan 15, 2024', 'Lunch', 'Food', '25.50'])
  })

  it('returns empty string with header only for empty input', () => {
    const csv = generateCSV([])
    expect(csv).toBe('Date,Description,Category,Amount')
  })
})
