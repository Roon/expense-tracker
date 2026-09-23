import { createInitialExportState, exportFormReducer } from '@/hooks/useExportOptions'
import { CATEGORIES } from '@/lib/types'

const NOW = new Date(2026, 8, 23)

describe('exportFormReducer', () => {
  const initial = createInitialExportState(NOW)

  it('starts with CSV, all time, all categories and a dated filename', () => {
    expect(initial).toEqual({
      format: 'csv',
      preset: 'all',
      startDate: '',
      endDate: '',
      categories: CATEGORIES,
      filename: 'expenses-2026-09-23',
    })
  })

  it('applies a preset', () => {
    const s = exportFormReducer(initial, { type: 'applyPreset', preset: 'thisMonth', now: NOW })
    expect(s).toMatchObject({ preset: 'thisMonth', startDate: '2026-09-01', endDate: '2026-09-23' })
  })

  it('switches to custom when a date is edited by hand', () => {
    const s1 = exportFormReducer(initial, { type: 'applyPreset', preset: 'thisMonth', now: NOW })
    const s2 = exportFormReducer(s1, { type: 'setEndDate', value: '2026-09-10' })
    expect(s2).toMatchObject({ preset: 'custom', startDate: '2026-09-01', endDate: '2026-09-10' })
  })

  it('toggles categories and keeps canonical order', () => {
    const off = exportFormReducer(initial, { type: 'toggleCategory', category: 'Food' })
    expect(off.categories).not.toContain('Food')
    const on = exportFormReducer(off, { type: 'toggleCategory', category: 'Food' })
    expect(on.categories).toEqual(CATEGORIES)
  })

  it('sets categories in canonical order', () => {
    const s = exportFormReducer(initial, { type: 'setCategories', categories: ['Other', 'Food'] })
    expect(s.categories).toEqual(['Food', 'Other'])
  })
})
