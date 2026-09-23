// lib/cloud/format.ts
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Expense } from '@/lib/types'
import { periodSlug } from './period'
import type { CellFormat, FileFormat, Period, Report, TemplateId } from './types'

/** Display formatting for a report cell, shared by the UI, CSV and email previews. */
export function formatCell(value: string | number | null | undefined, format: CellFormat = 'text'): string {
  if (value === null || value === undefined) return format === 'change' ? '—' : ''
  if (typeof value === 'string') return format === 'date' ? formatDate(value) : value
  switch (format) {
    case 'currency':
      return formatCurrency(value)
    case 'percent':
      return `${(value * 100).toFixed(1)}%`
    case 'change':
      return `${value >= 0 ? '+' : ''}${Math.round(value * 100)}%`
    case 'number':
      return value.toLocaleString('en-US')
    default:
      return String(value)
  }
}

function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Raw (machine-friendly) cell value for CSV: ISO dates, plain numbers. */
function rawCell(value: string | number | null | undefined, format: CellFormat = 'text'): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') {
    if (format === 'currency') return value.toFixed(2)
    if (format === 'percent' || format === 'change') return (value * 100).toFixed(1)
    return String(value)
  }
  return csvField(value)
}

/** Multi-section CSV: a title block, then each table separated by a blank line. */
export function reportToCSV(report: Report): string {
  const lines: string[] = [csvField(`${report.title} — ${report.periodLabel}`), `Generated,${report.generatedAt}`, '']
  report.tables.forEach((t, i) => {
    if (report.tables.length > 1) lines.push(csvField(t.title))
    lines.push(
      t.columns
        .map((c) => csvField(c.format === 'percent' || c.format === 'change' ? `${c.label} (%)` : c.label))
        .join(','),
    )
    for (const row of t.rows) lines.push(t.columns.map((c) => rawCell(row[c.key], c.format)).join(','))
    if (t.footer) lines.push(t.columns.map((c) => rawCell(t.footer![c.key], c.format)).join(','))
    if (i < report.tables.length - 1) lines.push('')
  })
  return lines.join('\r\n')
}

export function reportToJSON(report: Report, expenses?: Expense[]): string {
  // Backups embed the raw records so they can be restored losslessly.
  const body = report.templateId === 'full-backup' && expenses ? { ...report, expenses } : report
  return JSON.stringify(body, null, 2)
}

export function serializeReport(report: Report, format: FileFormat, expenses?: Expense[]): Blob {
  return format === 'csv'
    ? new Blob(['﻿' + reportToCSV(report)], { type: 'text/csv;charset=utf-8' })
    : new Blob([reportToJSON(report, expenses)], { type: 'application/json' })
}

export function reportFileName(templateId: TemplateId, period: Period, format: FileFormat): string {
  return `${templateId}-${periodSlug(period)}.${format}`
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** Plain-text digest for pasting into Slack, Notion, a text message… */
export function reportToText(report: Report, link?: string): string {
  const lines = [`*${report.title} · ${report.periodLabel}*`]
  for (const h of report.highlights) lines.push(`• ${h.label}: ${h.value}${h.hint ? ` (${h.hint})` : ''}`)
  const firstTable = report.tables.find((t) => !t.itemized)
  if (firstTable) {
    const labelCol = firstTable.columns[0]
    const valueCol = firstTable.columns.find((c) => c.format === 'currency')
    if (valueCol) {
      lines.push('', firstTable.title)
      for (const r of firstTable.rows.slice(0, 6)) {
        lines.push(`  ${formatCell(r[labelCol.key])}: ${formatCell(r[valueCol.key], 'currency')}`)
      }
    }
  }
  if (link) lines.push('', `Full report: ${link}`)
  return lines.join('\n')
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000
  const future = diff < 0
  const s = Math.abs(diff)
  const fmt = (n: number, unit: string) => {
    const v = Math.round(n)
    const str = `${v} ${unit}${v === 1 ? '' : 's'}`
    return future ? `in ${str}` : `${str} ago`
  }
  if (s < 45) return future ? 'in a moment' : 'just now'
  if (s < 3600) return fmt(s / 60, 'min')
  if (s < 86400) return fmt(s / 3600, 'hour')
  if (s < 86400 * 30) return fmt(s / 86400, 'day')
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
