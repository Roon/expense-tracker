// __tests__/useExpenses.test.ts
import { renderHook, act } from '@testing-library/react'
import { useExpenses } from '@/hooks/useExpenses'
import type { ExpenseFormData } from '@/lib/types'

const mockStorage: Record<string, string> = {}
const localStorageMock = {
  getItem: jest.fn((key: string) => mockStorage[key] ?? null),
  setItem: jest.fn((key: string, val: string) => { mockStorage[key] = val }),
  removeItem: jest.fn((key: string) => { delete mockStorage[key] }),
  clear: jest.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]) }),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

const FOOD_EXPENSE: ExpenseFormData = {
  date: '2024-01-15',
  amount: 25.50,
  category: 'Food',
  description: 'Lunch',
}

const BILLS_EXPENSE: ExpenseFormData = {
  date: '2024-01-10',
  amount: 80,
  category: 'Bills',
  description: 'Electricity',
}

beforeEach(() => {
  localStorageMock.clear()
  jest.clearAllMocks()
})

describe('useExpenses', () => {
  it('starts with empty expenses and isLoaded true after mount', async () => {
    const { result } = renderHook(() => useExpenses())
    expect(result.current.isLoaded).toBe(true)
    expect(result.current.expenses).toEqual([])
  })

  it('adds an expense with a generated id', () => {
    const { result } = renderHook(() => useExpenses())
    act(() => result.current.addExpense(FOOD_EXPENSE))
    expect(result.current.expenses).toHaveLength(1)
    expect(result.current.expenses[0]).toMatchObject(FOOD_EXPENSE)
    expect(result.current.expenses[0].id).toBeDefined()
  })

  it('persists added expense to localStorage', () => {
    const { result } = renderHook(() => useExpenses())
    act(() => result.current.addExpense(FOOD_EXPENSE))
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'expense-tracker-expenses',
      expect.stringContaining('Lunch'),
    )
  })

  it('sorts expenses newest-first by date', () => {
    const { result } = renderHook(() => useExpenses())
    act(() => {
      result.current.addExpense(BILLS_EXPENSE)  // date: 2024-01-10
      result.current.addExpense(FOOD_EXPENSE)   // date: 2024-01-15
    })
    expect(result.current.expenses[0].date).toBe('2024-01-15')
    expect(result.current.expenses[1].date).toBe('2024-01-10')
  })

  it('updates an expense by id', () => {
    const { result } = renderHook(() => useExpenses())
    act(() => result.current.addExpense(FOOD_EXPENSE))
    const id = result.current.expenses[0].id
    act(() => result.current.updateExpense(id, { ...FOOD_EXPENSE, description: 'Dinner' }))
    expect(result.current.expenses[0].description).toBe('Dinner')
    expect(result.current.expenses).toHaveLength(1)
  })

  it('deletes an expense by id', () => {
    const { result } = renderHook(() => useExpenses())
    act(() => result.current.addExpense(FOOD_EXPENSE))
    const id = result.current.expenses[0].id
    act(() => result.current.deleteExpense(id))
    expect(result.current.expenses).toHaveLength(0)
  })

  it('loads pre-existing data from localStorage on mount', () => {
    const existing = [{ id: 'abc', ...FOOD_EXPENSE }]
    mockStorage['expense-tracker-expenses'] = JSON.stringify(existing)
    const { result } = renderHook(() => useExpenses())
    expect(result.current.expenses).toHaveLength(1)
    expect(result.current.expenses[0].id).toBe('abc')
  })

  it('handles corrupt localStorage gracefully', () => {
    mockStorage['expense-tracker-expenses'] = 'not-json'
    const { result } = renderHook(() => useExpenses())
    expect(result.current.expenses).toEqual([])
    expect(result.current.isLoaded).toBe(true)
  })
})
