// components/cloud/Composer.tsx
'use client'

import { Check, FileSpreadsheet, FileText, ChartPie, Archive, type LucideIcon } from 'lucide-react'
import type { Expense } from '@/lib/types'
import { DESTINATION_ORDER, INTEGRATIONS } from '@/lib/cloud/integrations'
import { periodLabel, shortMonth } from '@/lib/cloud/period'
import { TEMPLATES } from '@/lib/cloud/templates'
import type { Connection, DestinationId, Period, TemplateId } from '@/lib/cloud/types'
import { IntegrationLogo } from './IntegrationLogo'
import { inputClass } from './DestinationConfigEditor'

const TEMPLATE_ICONS: Record<TemplateId, LucideIcon> = {
  'monthly-summary': FileText,
  'tax-report': FileSpreadsheet,
  'category-analysis': ChartPie,
  'full-backup': Archive,
}

export function TemplateGallery({ value, onChange }: { value: TemplateId; onChange: (t: TemplateId) => void }) {
  return (
    <div role="radiogroup" aria-label="Report template" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Object.values(TEMPLATES).map((t) => {
        const Icon = TEMPLATE_ICONS[t.id]
        const selected = t.id === value
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(t.id)}
            className={`group relative overflow-hidden rounded-2xl border bg-white p-4 text-left transition-all ${
              selected ? 'border-indigo-500 shadow-md shadow-indigo-500/10 ring-2 ring-indigo-500/30' : 'border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm'
            }`}
          >
            <span className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white ${t.accent}`}>
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            {selected && (
              <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600">
                <Check className="h-3 w-3 text-white" aria-hidden />
              </span>
            )}
            <p className="font-semibold text-slate-900">{t.name}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{t.tagline}</p>
            <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">For · {t.audience}</p>
          </button>
        )
      })}
    </div>
  )
}

/** Months/years that have data, plus the current ones, newest first. */
export function availablePeriods(expenses: Expense[], now = new Date()) {
  const months = new Set<string>([`${now.getFullYear()}-${now.getMonth()}`])
  const years = new Set<number>([now.getFullYear()])
  for (const e of expenses) {
    const [y, m] = e.date.split('-').map(Number)
    months.add(`${y}-${m - 1}`)
    years.add(y)
  }
  return {
    months: Array.from(months)
      .map((k) => k.split('-').map(Number) as [number, number])
      .sort((a, b) => b[0] - a[0] || b[1] - a[1]),
    years: Array.from(years).sort((a, b) => b - a),
  }
}

export function PeriodPicker({
  kinds,
  value,
  onChange,
  expenses,
}: {
  kinds: Period['kind'][]
  value: Period
  onChange: (p: Period) => void
  expenses: Expense[]
}) {
  const { months, years } = availablePeriods(expenses)
  if (kinds.length === 1 && kinds[0] === 'all') {
    return <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">All time · every record</p>
  }
  const key = value.kind === 'month' ? `m:${value.year}-${value.month}` : value.kind === 'year' ? `y:${value.year}` : 'all'
  return (
    <select
      aria-label="Period"
      className={inputClass}
      value={key}
      onChange={(e) => {
        const v = e.target.value
        if (v === 'all') onChange({ kind: 'all' })
        else if (v.startsWith('y:')) onChange({ kind: 'year', year: Number(v.slice(2)) })
        else {
          const [y, m] = v.slice(2).split('-').map(Number)
          onChange({ kind: 'month', year: y, month: m })
        }
      }}
    >
      {kinds.includes('month') && (
        <optgroup label="Month">
          {months.map(([y, m]) => (
            <option key={`${y}-${m}`} value={`m:${y}-${m}`}>{shortMonth(m)} {y}</option>
          ))}
        </optgroup>
      )}
      {kinds.includes('year') && (
        <optgroup label="Year">
          {years.map((y) => <option key={y} value={`y:${y}`}>{y}</option>)}
        </optgroup>
      )}
      {kinds.includes('all') && <option value="all">{periodLabel({ kind: 'all' })}</option>}
    </select>
  )
}

export function DestinationGrid({
  value,
  connections,
  onChange,
}: {
  value: DestinationId
  connections: Partial<Record<DestinationId, Connection>>
  onChange: (d: DestinationId) => void
}) {
  return (
    <div role="radiogroup" aria-label="Destination" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
      {DESTINATION_ORDER.map((id) => {
        const i = INTEGRATIONS[id]
        const conn = connections[id]
        const selected = id === value
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(id)}
            className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors ${
              selected ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500' : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <IntegrationLogo id={id} size="sm" status={conn?.status} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-slate-900">{i.name}</span>
              <span className="block truncate text-[11px] text-slate-500">
                {i.requiresConnection ? (conn ? 'Connected' : 'Not connected') : i.blurb}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

