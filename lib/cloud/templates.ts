// lib/cloud/templates.ts
import type { Category, Expense } from '@/lib/types'
import { CATEGORIES } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { filterByPeriod, periodLabel, previousMonth, shortMonth } from './period'
import type { Period, Report, ReportTable, TemplateId } from './types'

export interface TemplateDefinition {
  id: TemplateId
  name: string
  tagline: string
  audience: string
  /** Which period granularities make sense for this template. */
  periodKinds: Period['kind'][]
  accent: string
  build: (expenses: Expense[], period: Period, now?: Date) => Report
}

const cents = (n: number) => Math.round(n * 100) / 100
const sum = (xs: Expense[]) => cents(xs.reduce((s, e) => s + e.amount, 0))
const byDateDesc = (a: Expense, b: Expense) => b.date.localeCompare(a.date) || a.description.localeCompare(b.description)

function groupByCategory(expenses: Expense[]): Map<Category, Expense[]> {
  const map = new Map<Category, Expense[]>()
  for (const cat of CATEGORIES) map.set(cat, [])
  for (const e of expenses) map.get(e.category)!.push(e)
  return map
}

function ledgerTable(expenses: Expense[], title = 'Itemized transactions'): ReportTable {
  const rows = [...expenses].sort(byDateDesc)
  return {
    id: 'ledger',
    title,
    itemized: true,
    columns: [
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'category', label: 'Category' },
      { key: 'description', label: 'Description' },
      { key: 'amount', label: 'Amount', format: 'currency' },
    ],
    rows: rows.map((e) => ({ date: e.date, category: e.category, description: e.description, amount: e.amount })),
    footer: { date: null, category: null, description: 'Total', amount: sum(rows) },
  }
}

function base(templateId: TemplateId, title: string, period: Period, records: Expense[], now: Date) {
  return {
    templateId,
    title,
    periodLabel: periodLabel(period),
    generatedAt: now.toISOString(),
    recordCount: records.length,
  }
}

// ---- Monthly Summary ----------------------------------------------------

function buildMonthlySummary(all: Expense[], period: Period, now = new Date()): Report {
  if (period.kind !== 'month') throw new Error('Monthly summary requires a month period')
  const current = filterByPeriod(all, period)
  const prevPeriod = previousMonth(period)
  const previous = filterByPeriod(all, prevPeriod)
  const total = sum(current)
  const prevTotal = sum(previous)
  const change = prevTotal === 0 ? null : (total - prevTotal) / prevTotal
  const daysInMonth = new Date(period.year, period.month + 1, 0).getDate()
  const isCurrentMonth = period.year === now.getFullYear() && period.month === now.getMonth()
  const daysElapsed = isCurrentMonth ? now.getDate() : daysInMonth
  const biggest = [...current].sort((a, b) => b.amount - a.amount)[0]

  const cur = groupByCategory(current)
  const prev = groupByCategory(previous)
  const categoryRows = CATEGORIES.map((cat) => {
    const t = sum(cur.get(cat)!)
    const p = sum(prev.get(cat)!)
    return { category: cat, total: t, previous: p, change: p === 0 ? null : (t - p) / p }
  }).filter((r) => r.total > 0 || r.previous > 0)

  return {
    ...base('monthly-summary', 'Monthly Summary', period, current, now),
    highlights: [
      { label: 'Total spent', value: formatCurrency(total) },
      {
        label: `vs ${shortMonth(prevPeriod.month)}`,
        value: change === null ? '—' : `${change >= 0 ? '+' : ''}${Math.round(change * 100)}%`,
        hint: `${formatCurrency(prevTotal)} last month`,
      },
      { label: 'Daily average', value: formatCurrency(cents(total / daysElapsed)) },
      {
        label: 'Largest expense',
        value: biggest ? formatCurrency(biggest.amount) : '—',
        hint: biggest?.description,
      },
    ],
    tables: [
      {
        id: 'by-category',
        title: 'Spending by category',
        columns: [
          { key: 'category', label: 'Category' },
          { key: 'total', label: periodLabel(period), format: 'currency' },
          { key: 'previous', label: periodLabel(prevPeriod), format: 'currency' },
          { key: 'change', label: 'Change', format: 'change' },
        ],
        rows: categoryRows,
        footer: { category: 'Total', total, previous: prevTotal, change },
      },
      ledgerTable(current),
    ],
  }
}

// ---- Tax Report ---------------------------------------------------------

function buildTaxReport(all: Expense[], period: Period, now = new Date()): Report {
  if (period.kind !== 'year') throw new Error('Tax report requires a year period')
  const records = filterByPeriod(all, period)
  const total = sum(records)
  const groups = groupByCategory(records)
  const activeCats = CATEGORIES.filter((c) => groups.get(c)!.length > 0)

  return {
    ...base('tax-report', 'Annual Tax Report', period, records, now),
    highlights: [
      { label: 'Tax year', value: String(period.year) },
      { label: 'Total expenses', value: formatCurrency(total) },
      { label: 'Transactions', value: records.length.toLocaleString('en-US') },
      { label: 'Categories', value: String(activeCats.length) },
    ],
    tables: [
      {
        id: 'category-subtotals',
        title: 'Category subtotals',
        columns: [
          { key: 'category', label: 'Category' },
          { key: 'count', label: 'Transactions', format: 'number' },
          { key: 'total', label: 'Subtotal', format: 'currency' },
          { key: 'share', label: 'Share', format: 'percent' },
        ],
        rows: activeCats.map((cat) => {
          const t = sum(groups.get(cat)!)
          return { category: cat, count: groups.get(cat)!.length, total: t, share: total ? t / total : 0 }
        }),
        footer: { category: 'Total', count: records.length, total, share: total ? 1 : 0 },
      },
      {
        id: 'by-month',
        title: 'Monthly totals',
        columns: [
          { key: 'month', label: 'Month' },
          { key: 'count', label: 'Transactions', format: 'number' },
          { key: 'total', label: 'Total', format: 'currency' },
        ],
        rows: Array.from({ length: 12 }, (_, m) => {
          const xs = filterByPeriod(records, { kind: 'month', year: period.year, month: m })
          return { month: `${shortMonth(m)} ${period.year}`, count: xs.length, total: sum(xs) }
        }),
        footer: { month: 'Total', count: records.length, total },
      },
      ledgerTable(records, 'Itemized ledger'),
    ],
  }
}

// ---- Category Analysis --------------------------------------------------

function buildCategoryAnalysis(all: Expense[], period: Period, now = new Date()): Report {
  const records = filterByPeriod(all, period)
  const total = sum(records)
  const groups = groupByCategory(records)
  const rows = CATEGORIES.map((cat) => {
    const xs = groups.get(cat)!
    const t = sum(xs)
    return {
      category: cat,
      count: xs.length,
      total: t,
      average: xs.length ? cents(t / xs.length) : 0,
      largest: xs.length ? Math.max(...xs.map((e) => e.amount)) : 0,
      share: total ? t / total : 0,
    }
  })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.total - a.total)

  const top = rows[0]
  const frequent = [...rows].sort((a, b) => b.count - a.count)[0]

  return {
    ...base('category-analysis', 'Category Analysis', period, records, now),
    highlights: [
      { label: 'Top category', value: top?.category ?? '—', hint: top ? formatCurrency(top.total) : undefined },
      {
        label: 'Most frequent',
        value: frequent?.category ?? '—',
        hint: frequent ? `${frequent.count} transactions` : undefined,
      },
      { label: 'Avg transaction', value: formatCurrency(records.length ? cents(total / records.length) : 0) },
      { label: 'Total', value: formatCurrency(total) },
    ],
    tables: [
      {
        id: 'categories',
        title: 'Category breakdown',
        columns: [
          { key: 'category', label: 'Category' },
          { key: 'count', label: 'Count', format: 'number' },
          { key: 'total', label: 'Total', format: 'currency' },
          { key: 'average', label: 'Average', format: 'currency' },
          { key: 'largest', label: 'Largest', format: 'currency' },
          { key: 'share', label: 'Share', format: 'percent' },
        ],
        rows,
        footer: {
          category: 'Total',
          count: records.length,
          total,
          average: records.length ? cents(total / records.length) : 0,
          largest: records.length ? Math.max(...records.map((e) => e.amount)) : 0,
          share: total ? 1 : 0,
        },
      },
    ],
  }
}

// ---- Full Backup --------------------------------------------------------

function buildFullBackup(all: Expense[], period: Period, now = new Date()): Report {
  const sorted = [...all].sort(byDateDesc)
  const first = sorted[sorted.length - 1]?.date
  const last = sorted[0]?.date
  return {
    ...base('full-backup', 'Full Backup', { kind: 'all' }, all, now),
    highlights: [
      { label: 'Records', value: all.length.toLocaleString('en-US') },
      { label: 'Total', value: formatCurrency(sum(all)) },
      { label: 'From', value: first ? formatDate(first) : '—' },
      { label: 'To', value: last ? formatDate(last) : '—' },
    ],
    tables: [
      {
        id: 'expenses',
        title: 'All expenses',
        itemized: true,
        columns: [
          { key: 'id', label: 'ID' },
          { key: 'date', label: 'Date', format: 'date' },
          { key: 'category', label: 'Category' },
          { key: 'amount', label: 'Amount', format: 'currency' },
          { key: 'description', label: 'Description' },
        ],
        rows: sorted.map((e) => ({ id: e.id, date: e.date, category: e.category, amount: e.amount, description: e.description })),
      },
    ],
  }
}

export const TEMPLATES: Record<TemplateId, TemplateDefinition> = {
  'monthly-summary': {
    id: 'monthly-summary',
    name: 'Monthly Summary',
    tagline: 'Month-over-month spending with category changes.',
    audience: 'Household budget check-ins',
    periodKinds: ['month'],
    accent: 'from-indigo-500 to-violet-500',
    build: buildMonthlySummary,
  },
  'tax-report': {
    id: 'tax-report',
    name: 'Tax Report',
    tagline: 'Annual subtotals, monthly totals and an itemized ledger.',
    audience: 'Your accountant',
    periodKinds: ['year'],
    accent: 'from-emerald-500 to-teal-500',
    build: buildTaxReport,
  },
  'category-analysis': {
    id: 'category-analysis',
    name: 'Category Analysis',
    tagline: 'Where the money goes: totals, averages and share by category.',
    audience: 'Finding savings',
    periodKinds: ['month', 'year', 'all'],
    accent: 'from-amber-500 to-orange-500',
    build: buildCategoryAnalysis,
  },
  'full-backup': {
    id: 'full-backup',
    name: 'Full Backup',
    tagline: 'Every record, lossless. Restore-ready JSON or CSV.',
    audience: 'Peace of mind',
    periodKinds: ['all'],
    accent: 'from-slate-600 to-slate-800',
    build: buildFullBackup,
  },
}

export function buildReport(templateId: TemplateId, expenses: Expense[], period: Period, now?: Date): Report {
  return TEMPLATES[templateId].build(expenses, period, now)
}

/** Privacy options applied before a report leaves the device via a share link. */
export function redactReport(report: Report, opts: { summaryOnly: boolean; hideDescriptions: boolean }): Report {
  let tables = report.tables
  // For a Full Backup this leaves only the highlights, which is the point: nothing itemized leaks.
  if (opts.summaryOnly) tables = tables.filter((t) => !t.itemized)
  if (opts.hideDescriptions) {
    tables = tables.map((t) =>
      t.columns.some((c) => c.key === 'description')
        ? { ...t, rows: t.rows.map((r) => ({ ...r, description: '•••' })) }
        : t,
    )
  }
  return { ...report, tables }
}
