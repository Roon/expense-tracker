/**
 * @jest-environment node
 */
import type { Expense } from '@/lib/types'
import { CATEGORIES } from '@/lib/types'
import {
  applyExportFilters,
  buildFilename,
  exportExpenses,
  resolveDatePreset,
  sanitizeFilename,
  summarizeExpenses,
  validateFilters,
  type ExportFilters,
} from '@/lib/export'
import { escapeCSVField, toCSV } from '@/lib/export/formats/csv'
import { toJSONDocument } from '@/lib/export/formats/json'

const EXPENSES: Expense[] = [
  { id: '1', date: '2026-01-15', amount: 25.5, category: 'Food', description: 'Lunch' },
  { id: '2', date: '2026-02-10', amount: 80, category: 'Bills', description: 'Gas, electric' },
  { id: '3', date: '2026-03-05', amount: 9.99, category: 'Entertainment', description: 'He said "nice"' },
  { id: '4', date: '2026-03-20', amount: 0.1, category: 'Food', description: 'Gum' },
  { id: '5', date: '2026-03-20', amount: 0.2, category: 'Food', description: 'Candy' },
]
const ALL: ExportFilters = { startDate: '', endDate: '', categories: [...CATEGORIES] }
const NOW = new Date(2026, 8, 23, 14, 30) // Sep 23 2026, local time

describe('applyExportFilters', () => {
  it('returns everything sorted newest first, ties by description', () => {
    expect(applyExportFilters(EXPENSES, ALL).map((e) => e.id)).toEqual(['5', '4', '3', '2', '1'])
  })

  it('treats both date bounds as inclusive', () => {
    const r = applyExportFilters(EXPENSES, { ...ALL, startDate: '2026-02-10', endDate: '2026-03-05' })
    expect(r.map((e) => e.id)).toEqual(['3', '2'])
  })

  it('supports open-ended ranges', () => {
    expect(applyExportFilters(EXPENSES, { ...ALL, startDate: '2026-03-01' })).toHaveLength(3)
    expect(applyExportFilters(EXPENSES, { ...ALL, endDate: '2026-01-31' })).toHaveLength(1)
  })

  it('filters by category', () => {
    const r = applyExportFilters(EXPENSES, { ...ALL, categories: ['Bills', 'Entertainment'] })
    expect(r.map((e) => e.id)).toEqual(['3', '2'])
  })

  it('does not mutate the input array', () => {
    const copy = [...EXPENSES]
    applyExportFilters(EXPENSES, ALL)
    expect(EXPENSES).toEqual(copy)
  })
})

describe('summarizeExpenses', () => {
  it('computes count, cent-rounded total, span and per-category totals', () => {
    const s = summarizeExpenses(EXPENSES)
    expect(s.count).toBe(5)
    expect(s.total).toBe(115.79)
    expect(s.firstDate).toBe('2026-01-15')
    expect(s.lastDate).toBe('2026-03-20')
    expect(s.byCategory.Food).toEqual({ count: 3, total: 25.8 })
    expect(s.byCategory.Shopping).toBeUndefined()
  })

  it('avoids floating point drift', () => {
    expect(summarizeExpenses(EXPENSES.slice(3)).total).toBe(0.3)
  })

  it('handles an empty list', () => {
    expect(summarizeExpenses([])).toEqual({ count: 0, total: 0, firstDate: null, lastDate: null, byCategory: {} })
  })
})

describe('validateFilters', () => {
  it('requires at least one category', () => {
    expect(validateFilters({ ...ALL, categories: [] })).toMatch(/category/)
  })
  it('rejects a start date after the end date', () => {
    expect(validateFilters({ ...ALL, startDate: '2026-05-02', endDate: '2026-05-01' })).toMatch(/Start date/)
  })
  it('accepts a single-day range', () => {
    expect(validateFilters({ ...ALL, startDate: '2026-05-01', endDate: '2026-05-01' })).toBeNull()
  })
})

describe('resolveDatePreset', () => {
  it.each([
    ['all', '', ''],
    ['thisMonth', '2026-09-01', '2026-09-23'],
    ['lastMonth', '2026-08-01', '2026-08-31'],
    ['last30', '2026-08-25', '2026-09-23'],
    ['thisYear', '2026-01-01', '2026-09-23'],
  ] as const)('%s', (id, startDate, endDate) => {
    expect(resolveDatePreset(id, NOW)).toEqual({ startDate, endDate })
  })

  it('handles last month across a year boundary', () => {
    expect(resolveDatePreset('lastMonth', new Date(2026, 0, 10))).toEqual({
      startDate: '2025-12-01',
      endDate: '2025-12-31',
    })
  })
})

describe('filenames', () => {
  it('strips illegal characters and a typed extension', () => {
    expect(sanitizeFilename('  my/report: Q1?.csv ', 'csv')).toBe('myreport Q1')
  })
  it('keeps a different extension as part of the name', () => {
    expect(buildFilename('data.csv', 'json')).toBe('data.csv.json')
  })
  it('falls back to a dated default when the name is empty after sanitizing', () => {
    expect(buildFilename(' ??? ', 'pdf', NOW)).toBe('expenses-2026-09-23.pdf')
  })
  it('caps length', () => {
    expect(sanitizeFilename('a'.repeat(300), 'csv')).toHaveLength(100)
  })
})

describe('CSV format', () => {
  const payload = { expenses: applyExportFilters(EXPENSES, ALL), summary: summarizeExpenses(EXPENSES), filters: ALL, generatedAt: NOW }

  it('uses Date, Category, Amount, Description columns with ISO dates and CRLF', () => {
    const lines = toCSV(payload).split('\r\n')
    expect(lines[0]).toBe('Date,Category,Amount,Description')
    expect(lines).toContain('2026-01-15,Food,25.50,Lunch')
    expect(lines).toHaveLength(6)
  })

  it('quotes commas and escapes quotes', () => {
    const csv = toCSV(payload)
    expect(csv).toContain('"Gas, electric"')
    expect(csv).toContain('"He said ""nice"""')
  })

  it('neutralizes spreadsheet formula injection', () => {
    expect(escapeCSVField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(escapeCSVField('-5')).toBe("'-5")
    expect(escapeCSVField('Line\nbreak')).toBe('"Line\nbreak"')
  })
})

describe('JSON format', () => {
  it('includes metadata, filters, summary and only whitelisted fields', () => {
    const extra = { ...EXPENSES[0], secret: 'x' } as Expense
    const doc = toJSONDocument({
      expenses: [extra],
      summary: summarizeExpenses([extra]),
      filters: { ...ALL, startDate: '2026-01-01' },
      generatedAt: NOW,
    })
    expect(doc.exportedAt).toBe(NOW.toISOString())
    expect(doc.filters).toEqual({ startDate: '2026-01-01', endDate: null, categories: CATEGORIES })
    expect(doc.summary.count).toBe(1)
    expect(doc.expenses[0]).toEqual({ id: '1', date: '2026-01-15', category: 'Food', amount: 25.5, description: 'Lunch' })
  })
})

describe('exportExpenses', () => {
  const opts = (format: 'csv' | 'json' | 'pdf') => ({
    format,
    filename: 'q1 report',
    filters: { ...ALL, categories: ['Food' as const] },
  })

  it('produces a CSV blob with BOM and filtered rows', async () => {
    const r = await exportExpenses(EXPENSES, opts('csv'), NOW)
    expect(r.filename).toBe('q1 report.csv')
    expect(r.count).toBe(3)
    expect(r.blob.type).toBe('text/csv;charset=utf-8')
    const bytes = new Uint8Array(await r.blob.arrayBuffer())
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    const text = await r.blob.text()
    expect(text.split('\r\n')).toHaveLength(4)
  })

  it('produces parseable JSON', async () => {
    const r = await exportExpenses(EXPENSES, opts('json'), NOW)
    const parsed = JSON.parse(await r.blob.text())
    expect(parsed.expenses).toHaveLength(3)
    expect(parsed.summary.total).toBe(25.8)
  })

  it('produces a valid multi-page PDF for large exports', async () => {
    const many: Expense[] = Array.from({ length: 120 }, (_, i) => ({
      id: String(i),
      date: `2026-03-${String((i % 28) + 1).padStart(2, '0')}`,
      amount: i + 0.5,
      category: 'Food',
      description: `Item ${i}`,
    }))
    const r = await exportExpenses(many, opts('pdf'), NOW)
    expect(r.filename).toBe('q1 report.pdf')
    expect(r.blob.type).toBe('application/pdf')
    const text = await r.blob.text()
    expect(text.startsWith('%PDF-')).toBe(true)
    expect(text).toContain('Expense Report')
    expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1)
  })
})
