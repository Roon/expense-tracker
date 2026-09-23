/**
 * @jest-environment node
 */
import type { Expense } from '@/lib/types'
import { buildReport, redactReport } from '@/lib/cloud/templates'
import { formatCell, relativeTime, reportFileName, reportToCSV, reportToJSON, reportToText } from '@/lib/cloud/format'
import { decodeShare, encodeShare, type SharePayload } from '@/lib/cloud/share'
import { computeNextRun, describeTiming } from '@/lib/cloud/schedule'
import { periodLabel, relativePeriod } from '@/lib/cloud/period'
import { describeLocation, validateConfig } from '@/lib/cloud/integrations'

const E = (id: string, date: string, amount: number, category: Expense['category'], description = `item ${id}`): Expense => ({
  id, date, amount, category, description,
})

const EXPENSES: Expense[] = [
  E('1', '2026-09-02', 40, 'Food', 'Groceries'),
  E('2', '2026-09-10', 60, 'Food', 'Dinner, with friends'),
  E('3', '2026-09-15', 100, 'Bills', 'Electric'),
  E('4', '2026-08-05', 80, 'Food'),
  E('5', '2026-08-20', 20, 'Shopping'),
  E('6', '2025-12-31', 999, 'Other', 'Last year'),
]
const NOW = new Date(2026, 8, 20, 12, 0) // Sep 20 2026

describe('Monthly Summary', () => {
  const r = buildReport('monthly-summary', EXPENSES, { kind: 'month', year: 2026, month: 8 }, NOW)

  it('summarizes the month against the previous one', () => {
    expect(r.periodLabel).toBe('September 2026')
    expect(r.recordCount).toBe(3)
    const h = Object.fromEntries(r.highlights.map((x) => [x.label, x]))
    expect(h['Total spent'].value).toBe('$200.00')
    expect(h['vs Aug'].value).toBe('+100%')
    // Month in progress: average over the 20 elapsed days, not all 30.
    expect(h['Daily average'].value).toBe('$10.00')
    expect(h['Largest expense'].hint).toBe('Electric')
  })

  it('breaks down categories including ones only present last month', () => {
    const byCat = r.tables.find((t) => t.id === 'by-category')!
    // Canonical category order, not sorted by amount.
    expect(byCat.rows).toEqual([
      { category: 'Food', total: 100, previous: 80, change: 0.25 },
      { category: 'Shopping', total: 0, previous: 20, change: -1 },
      { category: 'Bills', total: 100, previous: 0, change: null },
    ])
    expect(byCat.footer).toMatchObject({ total: 200, previous: 100, change: 1 })
  })

  it('compares January with the previous December', () => {
    const jan = buildReport('monthly-summary', [...EXPENSES, E('7', '2026-01-03', 10, 'Food')], { kind: 'month', year: 2026, month: 0 }, NOW)
    expect(jan.highlights[1].label).toBe('vs Dec')
    expect(jan.highlights[1].hint).toBe('$999.00 last month')
  })
})

describe('Tax Report', () => {
  const r = buildReport('tax-report', EXPENSES, { kind: 'year', year: 2026 }, NOW)
  it('has subtotals with shares, 12 monthly rows and an itemized ledger', () => {
    const subtotals = r.tables.find((t) => t.id === 'category-subtotals')!
    expect(subtotals.rows.map((x) => [x.category, x.total])).toEqual([['Food', 180], ['Shopping', 20], ['Bills', 100]])
    expect(subtotals.footer).toMatchObject({ total: 300, count: 5, share: 1 })
    expect(r.tables.find((t) => t.id === 'by-month')!.rows).toHaveLength(12)
    const ledger = r.tables.find((t) => t.id === 'ledger')!
    expect(ledger.itemized).toBe(true)
    expect(ledger.rows[0].date).toBe('2026-09-15')
    expect(ledger.rows.some((x) => x.description === 'Last year')).toBe(false)
  })
})

describe('Category Analysis', () => {
  it('ranks categories by total with averages and largest', () => {
    const r = buildReport('category-analysis', EXPENSES, { kind: 'all' }, NOW)
    const t = r.tables[0]
    expect(t.rows[0]).toMatchObject({ category: 'Other', total: 999 })
    expect(t.rows.find((x) => x.category === 'Food')).toMatchObject({ count: 3, total: 180, average: 60, largest: 80 })
    expect(r.highlights[1]).toMatchObject({ label: 'Most frequent', value: 'Food' })
  })
})

describe('Full Backup', () => {
  it('includes every record and embeds raw expenses in JSON', () => {
    const r = buildReport('full-backup', EXPENSES, { kind: 'all' }, NOW)
    expect(r.recordCount).toBe(6)
    const json = JSON.parse(reportToJSON(r, EXPENSES))
    expect(json.expenses).toEqual(EXPENSES)
  })
})

describe('empty data', () => {
  it.each(['monthly-summary', 'tax-report', 'category-analysis', 'full-backup'] as const)('%s builds without throwing', (id) => {
    const period = id === 'monthly-summary' ? { kind: 'month' as const, year: 2026, month: 8 } : id === 'tax-report' ? { kind: 'year' as const, year: 2026 } : { kind: 'all' as const }
    const r = buildReport(id, [], period, NOW)
    expect(r.recordCount).toBe(0)
    expect(r.highlights.every((h) => !h.value.includes('NaN'))).toBe(true)
  })
})

describe('redactReport', () => {
  const r = buildReport('tax-report', EXPENSES, { kind: 'year', year: 2026 }, NOW)
  it('summary only drops itemized tables', () => {
    expect(redactReport(r, { summaryOnly: true, hideDescriptions: false }).tables.map((t) => t.id)).toEqual(['category-subtotals', 'by-month'])
  })
  it('summary only on a backup leaves no rows at all', () => {
    const backup = buildReport('full-backup', EXPENSES, { kind: 'all' }, NOW)
    expect(redactReport(backup, { summaryOnly: true, hideDescriptions: false }).tables).toEqual([])
  })
  it('masks descriptions but keeps amounts', () => {
    const ledger = redactReport(r, { summaryOnly: false, hideDescriptions: true }).tables.find((t) => t.id === 'ledger')!
    expect(ledger.rows.every((x) => x.description === '•••')).toBe(true)
    expect(ledger.rows[0].amount).toBe(100)
  })
})

describe('format', () => {
  const r = buildReport('tax-report', EXPENSES, { kind: 'year', year: 2026 }, NOW)

  it('writes multi-section CSV with raw values and escaping', () => {
    const csv = reportToCSV(r)
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('Annual Tax Report — 2026')
    expect(lines).toContain('Category subtotals')
    expect(lines).toContain('Category,Transactions,Subtotal,Share (%)')
    expect(lines).toContain('Food,3,180.00,60.0')
    expect(csv).toContain('"Dinner, with friends"')
    expect(lines).toContain('2026-09-15,Bills,Electric,100.00')
  })

  it('neutralizes formula injection in CSV', () => {
    const evil = buildReport('full-backup', [E('x', '2026-01-01', 1, 'Food', '=cmd()')], { kind: 'all' }, NOW)
    expect(reportToCSV(evil)).toContain("'=cmd()")
  })

  it('formats cells', () => {
    expect(formatCell(1234.5, 'currency')).toBe('$1,234.50')
    expect(formatCell(0.256, 'percent')).toBe('25.6%')
    expect(formatCell(-0.1, 'change')).toBe('-10%')
    expect(formatCell(null, 'change')).toBe('—')
    expect(formatCell('2026-09-02', 'date')).toBe('Sep 2, 2026')
  })

  it('builds a pasteable text digest', () => {
    const text = reportToText(r, 'https://x/share#abc')
    expect(text.split('\n')[0]).toBe('*Annual Tax Report · 2026*')
    expect(text).toContain('• Total expenses: $300.00')
    expect(text).toContain('  Food: $180.00')
    expect(text.endsWith('Full report: https://x/share#abc')).toBe(true)
  })

  it('names files by template and period', () => {
    expect(reportFileName('monthly-summary', { kind: 'month', year: 2026, month: 0 }, 'csv')).toBe('monthly-summary-2026-01.csv')
    expect(reportFileName('full-backup', { kind: 'all' }, 'json')).toBe('full-backup-all-time.json')
  })

  it('formats relative times', () => {
    expect(relativeTime(new Date(NOW.getTime() - 10_000).toISOString(), NOW)).toBe('just now')
    expect(relativeTime(new Date(NOW.getTime() - 5 * 60_000).toISOString(), NOW)).toBe('5 mins ago')
    expect(relativeTime(new Date(NOW.getTime() + 2 * 86_400_000).toISOString(), NOW)).toBe('in 2 days')
  })
})

describe('share links', () => {
  const report = buildReport('category-analysis', EXPENSES, { kind: 'all' }, NOW)
  const payload: SharePayload = { v: 1, report, sharedAt: NOW.toISOString(), expiresAt: null }

  it('round-trips through a compressed, URL-safe token', async () => {
    const token = await encodeShare(payload)
    expect(token.startsWith('z.')).toBe(true)
    expect(token).toMatch(/^[A-Za-z0-9._-]+$/)
    const decoded = await decodeShare(token, NOW)
    expect(decoded).toEqual({ ok: true, payload, expired: false })
  })

  it('compresses meaningfully', async () => {
    const big = buildReport('full-backup', Array.from({ length: 200 }, (_, i) => E(String(i), '2026-03-01', i, 'Food', 'Coffee')), { kind: 'all' }, NOW)
    const token = await encodeShare({ ...payload, report: big })
    expect(token.length).toBeLessThan(JSON.stringify(big).length / 3)
  })

  it('reports expiry', async () => {
    const token = await encodeShare({ ...payload, expiresAt: new Date(NOW.getTime() - 1000).toISOString() })
    expect(await decodeShare(token, NOW)).toMatchObject({ ok: true, expired: true })
  })

  it('rejects truncated or garbage tokens', async () => {
    const token = await encodeShare(payload)
    expect(await decodeShare(token.slice(0, 40), NOW)).toMatchObject({ ok: false })
    expect(await decodeShare('nonsense', NOW)).toMatchObject({ ok: false })
    expect(await decodeShare('q.abc', NOW)).toMatchObject({ ok: false, error: 'Unrecognized link format.' })
  })

  it('decodes the uncompressed fallback format', async () => {
    const json = Buffer.from(JSON.stringify(payload)).toString('base64url')
    expect(await decodeShare(`j.${json}`, NOW)).toMatchObject({ ok: true })
  })
})

describe('computeNextRun', () => {
  const at = (s: string) => new Date(s)
  it('daily: later today, else tomorrow', () => {
    const t = { frequency: 'daily' as const, weekday: 0, dayOfMonth: 1, time: '18:00' }
    expect(computeNextRun(t, at('2026-09-20T12:00:00'))).toEqual(at('2026-09-20T18:00:00'))
    expect(computeNextRun(t, at('2026-09-20T18:00:00'))).toEqual(at('2026-09-21T18:00:00'))
  })
  it('weekly: next matching weekday', () => {
    const monday = { frequency: 'weekly' as const, weekday: 1, dayOfMonth: 1, time: '08:00' }
    // Sep 20 2026 is a Sunday
    expect(computeNextRun(monday, at('2026-09-20T12:00:00'))).toEqual(at('2026-09-21T08:00:00'))
    expect(computeNextRun(monday, at('2026-09-21T09:00:00'))).toEqual(at('2026-09-28T08:00:00'))
  })
  it('monthly: this month if still ahead, else next, across year end', () => {
    const t = { frequency: 'monthly' as const, weekday: 0, dayOfMonth: 1, time: '08:00' }
    expect(computeNextRun(t, at('2026-09-20T12:00:00'))).toEqual(at('2026-10-01T08:00:00'))
    expect(computeNextRun(t, at('2026-12-05T12:00:00'))).toEqual(at('2027-01-01T08:00:00'))
    expect(computeNextRun({ ...t, dayOfMonth: 25 }, at('2026-09-20T12:00:00'))).toEqual(at('2026-09-25T08:00:00'))
  })
  it('describes timing', () => {
    expect(describeTiming({ frequency: 'monthly', weekday: 0, dayOfMonth: 22, time: '08:30' })).toBe('Monthly on the 22nd at 8:30 AM')
    expect(describeTiming({ frequency: 'weekly', weekday: 5, dayOfMonth: 1, time: '17:00' })).toBe('Every Friday at 5:00 PM')
  })
})

describe('relativePeriod', () => {
  it('monthly runs cover the month that just ended', () => {
    expect(periodLabel(relativePeriod('monthly-summary', 'monthly', new Date(2026, 0, 1)))).toBe('December 2025')
  })
  it('weekly runs cover month to date; tax covers the current year', () => {
    expect(periodLabel(relativePeriod('category-analysis', 'weekly', NOW))).toBe('September 2026')
    expect(periodLabel(relativePeriod('tax-report', 'monthly', NOW))).toBe('2026')
  })
})

describe('integrations', () => {
  it('validates destination configs', () => {
    expect(validateConfig({ kind: 'email', recipients: [], subject: '', message: '', includeLink: true })).toMatch(/recipient/)
    expect(validateConfig({ kind: 'email', recipients: ['a@b.co', 'nope'], subject: '', message: '', includeLink: true })).toMatch(/invalid/)
    expect(validateConfig({ kind: 'email', recipients: ['a@b.co'], subject: '', message: '', includeLink: true })).toBeNull()
    expect(validateConfig({ kind: 'folder', folder: 'Apps', format: 'csv' })).toMatch(/start with/)
    expect(validateConfig({ kind: 'channel', channel: 'finances' })).toMatch(/#channel/)
    expect(validateConfig({ kind: 'sheet', spreadsheetName: '  ', liveSync: false })).toMatch(/Name/)
  })
  it('describes where results land', () => {
    expect(describeLocation('dropbox', { kind: 'folder', folder: '/Apps/ET/', format: 'csv' }, 'x.csv')).toBe('Dropbox: /Apps/ET/x.csv')
  })
})
