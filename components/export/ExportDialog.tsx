// components/export/ExportDialog.tsx
'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CalendarRange, CircleAlert, CircleCheck, Download, Eye, FileDown, LoaderCircle, Tags, X } from 'lucide-react'
import type { Category, Expense } from '@/lib/types'
import { CATEGORIES } from '@/lib/types'
import { applyExportFilters, buildFilename, downloadBlob, exportExpenses, EXPORT_FORMATS } from '@/lib/export'
import { useExportOptions } from '@/hooks/useExportOptions'
import { formatCurrency } from '@/lib/utils'
import { FormatPicker } from './FormatPicker'
import { DateRangeFields } from './DateRangeFields'
import { CategoryFilter } from './CategoryFilter'
import { ExportPreview } from './ExportPreview'

type Status =
  | { kind: 'idle' }
  | { kind: 'exporting' }
  | { kind: 'success'; count: number; filename: string }
  | { kind: 'error'; message: string }

/** How long the success state stays visible before the dialog closes itself. */
const SUCCESS_CLOSE_DELAY_MS = 1500

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

export function ExportDialog({ expenses, onClose }: { expenses: Expense[]; onClose: () => void }) {
  const { state, dispatch, options, selected, summary, validationError, canExport } = useExportOptions(expenses)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const panelRef = useRef<HTMLDivElement>(null)
  const busy = status.kind === 'exporting' || status.kind === 'success'

  // Per-category counts within the current date range, ignoring the category filter.
  const categoryCounts = useMemo(() => {
    const inRange = applyExportFilters(expenses, {
      startDate: state.startDate,
      endDate: state.endDate,
      categories: CATEGORIES,
    })
    const counts: Partial<Record<Category, number>> = {}
    for (const e of inRange) counts[e.category] = (counts[e.category] ?? 0) + 1
    return counts
  }, [expenses, state.startDate, state.endDate])

  const extension = EXPORT_FORMATS[state.format].extension
  const resolvedFilename = buildFilename(state.filename, extension)

  // Escape to close, Tab trapped inside the panel, background scroll locked,
  // focus restored to the trigger on close.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const busyRef = useRef(busy)
  busyRef.current = busy
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) {
        e.preventDefault()
        onCloseRef.current()
      } else if (e.key === 'Tab' && panelRef.current) {
        const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        if (nodes.length === 0) return
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus?.()
    }
  }, [])

  useEffect(() => {
    if (status.kind !== 'success') return
    const t = setTimeout(() => onCloseRef.current(), SUCCESS_CLOSE_DELAY_MS)
    return () => clearTimeout(t)
  }, [status.kind])

  async function handleExport() {
    if (!canExport || busy) return
    setStatus({ kind: 'exporting' })
    try {
      const result = await exportExpenses(expenses, options)
      downloadBlob(result.blob, result.filename)
      setStatus({ kind: 'success', count: result.count, filename: result.filename })
    } catch (err) {
      console.error('Export failed', err)
      setStatus({ kind: 'error', message: 'Export failed. Please try again.' })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        aria-describedby="export-dialog-desc"
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[88vh] sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-50 p-2">
              <FileDown className="h-5 w-5 text-indigo-600" aria-hidden />
            </div>
            <div>
              <h2 id="export-dialog-title" className="font-semibold text-gray-900">
                Export expenses
              </h2>
              <p id="export-dialog-desc" className="text-sm text-gray-500">
                Choose a format, narrow the data, and review before downloading.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
            aria-label="Close export dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body: options | preview */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          <div className="space-y-6 border-gray-100 px-6 py-5 lg:w-[22rem] lg:shrink-0 lg:overflow-y-auto lg:border-r">
            <Section icon={FileDown} title="Format">
              <FormatPicker
                value={state.format}
                disabled={busy}
                onChange={(format) => dispatch({ type: 'setFormat', format })}
              />
            </Section>

            <Section icon={CalendarRange} title="Date range">
              <DateRangeFields
                preset={state.preset}
                startDate={state.startDate}
                endDate={state.endDate}
                invalid={!!state.startDate && !!state.endDate && state.startDate > state.endDate}
                disabled={busy}
                onPreset={(preset) => dispatch({ type: 'applyPreset', preset })}
                onStartDate={(value) => dispatch({ type: 'setStartDate', value })}
                onEndDate={(value) => dispatch({ type: 'setEndDate', value })}
              />
            </Section>

            <Section
              icon={Tags}
              title="Categories"
              aside={`${state.categories.length} of ${CATEGORIES.length}`}
            >
              <CategoryFilter
                selected={state.categories}
                counts={categoryCounts}
                disabled={busy}
                onToggle={(category) => dispatch({ type: 'toggleCategory', category })}
                onSetAll={(categories) => dispatch({ type: 'setCategories', categories })}
              />
            </Section>

            <Section icon={Download} title="File name">
              <div className="flex rounded-lg border border-gray-300 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                <input
                  type="text"
                  value={state.filename}
                  disabled={busy}
                  onChange={(e) => dispatch({ type: 'setFilename', value: e.target.value })}
                  aria-label="File name"
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded-l-lg px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none"
                />
                <span className="flex items-center rounded-r-lg border-l border-gray-200 bg-gray-50 px-2.5 text-sm text-gray-500">
                  .{extension}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-gray-500" title={resolvedFilename}>
                Saves as <span className="font-mono text-gray-700">{resolvedFilename}</span>
              </p>
            </Section>
          </div>

          <div className="flex min-h-[320px] flex-1 flex-col px-6 py-5 lg:min-h-0">
            <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <Eye className="h-3.5 w-3.5" aria-hidden />
              Preview
            </h3>
            <div className="min-h-0 flex-1">
              <ExportPreview expenses={selected} summary={summary} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-[1.25rem] text-sm" aria-live="polite">
            <FooterMessage
              status={status}
              validationError={validationError}
              count={summary.count}
              total={summary.total}
              formatLabel={EXPORT_FORMATS[state.format].label}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 sm:flex-none"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={!canExport || busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300 sm:min-w-[11rem] sm:flex-none"
            >
              {status.kind === 'exporting' ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                  Preparing {EXPORT_FORMATS[state.format].label}…
                </>
              ) : status.kind === 'success' ? (
                <>
                  <CircleCheck className="h-4 w-4" aria-hidden />
                  Downloaded
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" aria-hidden />
                  Export {summary.count.toLocaleString('en-US')} record{summary.count === 1 ? '' : 's'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  aside,
  children,
}: {
  icon: typeof FileDown
  title: string
  aside?: string
  children: ReactNode
}) {
  return (
    <section>
      <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        <span className="flex-1">{title}</span>
        {aside && <span className="font-normal normal-case tracking-normal text-gray-400">{aside}</span>}
      </h3>
      {children}
    </section>
  )
}

function FooterMessage({
  status,
  validationError,
  count,
  total,
  formatLabel,
}: {
  status: Status
  validationError: string | null
  count: number
  total: number
  formatLabel: string
}) {
  if (status.kind === 'success') {
    return (
      <span className="flex items-center gap-1.5 text-emerald-700">
        <CircleCheck className="h-4 w-4" aria-hidden />
        Exported {status.count.toLocaleString('en-US')} record{status.count === 1 ? '' : 's'} to{' '}
        <span className="font-mono">{status.filename}</span>
      </span>
    )
  }
  if (status.kind === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-red-600" role="alert">
        <CircleAlert className="h-4 w-4" aria-hidden />
        {status.message}
      </span>
    )
  }
  if (validationError) {
    return (
      <span className="flex items-center gap-1.5 text-amber-700">
        <CircleAlert className="h-4 w-4" aria-hidden />
        {validationError}
      </span>
    )
  }
  if (count === 0) return <span className="text-gray-500">Nothing to export with the current filters.</span>
  return (
    <span className="text-gray-600">
      <span className="font-semibold text-gray-900">{count.toLocaleString('en-US')}</span> record
      {count === 1 ? '' : 's'} · <span className="font-semibold text-gray-900">{formatCurrency(total)}</span> as{' '}
      {formatLabel}
    </span>
  )
}
