'use client'

import { useMemo, useReducer } from 'react'
import type { Category, Expense } from '@/lib/types'
import { CATEGORIES } from '@/lib/types'
import {
  applyExportFilters,
  defaultFilename,
  resolveDatePreset,
  summarizeExpenses,
  validateFilters,
  type DatePresetId,
  type ExportFormat,
  type ExportOptions,
} from '@/lib/export'

export interface ExportFormState {
  format: ExportFormat
  preset: DatePresetId
  startDate: string
  endDate: string
  categories: Category[]
  filename: string
}

type Action =
  | { type: 'setFormat'; format: ExportFormat }
  | { type: 'applyPreset'; preset: Exclude<DatePresetId, 'custom'>; now?: Date }
  | { type: 'setStartDate'; value: string }
  | { type: 'setEndDate'; value: string }
  | { type: 'toggleCategory'; category: Category }
  | { type: 'setCategories'; categories: Category[] }
  | { type: 'setFilename'; value: string }

export function createInitialExportState(now: Date = new Date()): ExportFormState {
  return {
    format: 'csv',
    preset: 'all',
    startDate: '',
    endDate: '',
    categories: [...CATEGORIES],
    filename: defaultFilename(now),
  }
}

export function exportFormReducer(state: ExportFormState, action: Action): ExportFormState {
  switch (action.type) {
    case 'setFormat':
      return { ...state, format: action.format }
    case 'applyPreset':
      return { ...state, preset: action.preset, ...resolveDatePreset(action.preset, action.now) }
    // Hand-editing a date always switches to the custom preset.
    case 'setStartDate':
      return { ...state, preset: 'custom', startDate: action.value }
    case 'setEndDate':
      return { ...state, preset: 'custom', endDate: action.value }
    case 'toggleCategory': {
      const has = state.categories.includes(action.category)
      const next = has
        ? state.categories.filter((c) => c !== action.category)
        : [...state.categories, action.category]
      // Keep canonical ordering so exports list categories consistently.
      return { ...state, categories: CATEGORIES.filter((c) => next.includes(c)) }
    }
    case 'setCategories':
      return { ...state, categories: CATEGORIES.filter((c) => action.categories.includes(c)) }
    case 'setFilename':
      return { ...state, filename: action.value }
  }
}

export function useExportOptions(expenses: Expense[]) {
  const [state, dispatch] = useReducer(exportFormReducer, undefined, () => createInitialExportState())

  const filters = useMemo(
    () => ({ startDate: state.startDate, endDate: state.endDate, categories: state.categories }),
    [state.startDate, state.endDate, state.categories],
  )
  const selected = useMemo(() => applyExportFilters(expenses, filters), [expenses, filters])
  const summary = useMemo(() => summarizeExpenses(selected), [selected])
  const validationError = validateFilters(filters)

  const options: ExportOptions = useMemo(
    () => ({ format: state.format, filters, filename: state.filename }),
    [state.format, filters, state.filename],
  )

  return {
    state,
    dispatch,
    options,
    selected,
    summary,
    validationError,
    canExport: !validationError && selected.length > 0,
  }
}
