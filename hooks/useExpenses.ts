'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Expense, ExpenseFormData } from '@/lib/types'

export const STORAGE_KEY = 'expense-tracker-expenses'

export function loadFromStorage(): Expense[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveToStorage(expenses: Expense[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses))
  } catch {
    // quota exceeded — fail silently
  }
}

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setExpenses(loadFromStorage())
    setIsLoaded(true)
  }, [])

  const addExpense = useCallback((data: ExpenseFormData) => {
    const next: Expense = { ...data, id: crypto.randomUUID() }
    setExpenses((prev) => {
      const updated = [next, ...prev]
      saveToStorage(updated)
      return updated
    })
  }, [])

  const updateExpense = useCallback((id: string, data: ExpenseFormData) => {
    setExpenses((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...data, id } : e))
      saveToStorage(updated)
      return updated
    })
  }, [])

  const deleteExpense = useCallback((id: string) => {
    setExpenses((prev) => {
      const updated = prev.filter((e) => e.id !== id)
      saveToStorage(updated)
      return updated
    })
  }, [])

  // Stable identity between renders so consumers can safely memoize on it.
  const sorted = useMemo(() => [...expenses].sort((a, b) => b.date.localeCompare(a.date)), [expenses])

  return { expenses: sorted, isLoaded, addExpense, updateExpense, deleteExpense }
}
