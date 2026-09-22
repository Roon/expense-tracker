// lib/types.ts
export type Category =
  | 'Food'
  | 'Transportation'
  | 'Entertainment'
  | 'Shopping'
  | 'Bills'
  | 'Other'

export interface Expense {
  id: string
  date: string
  amount: number
  category: Category
  description: string
}

export type ExpenseFormData = Omit<Expense, 'id'>

export const CATEGORIES: Category[] = [
  'Food',
  'Transportation',
  'Entertainment',
  'Shopping',
  'Bills',
  'Other',
]

export const CATEGORY_COLORS: Record<Category, string> = {
  Food: '#6366f1',
  Transportation: '#8b5cf6',
  Entertainment: '#a78bfa',
  Shopping: '#f59e0b',
  Bills: '#ef4444',
  Other: '#6b7280',
}

export const CATEGORY_BADGE_COLORS: Record<Category, string> = {
  Food: 'bg-indigo-100 text-indigo-800',
  Transportation: 'bg-violet-100 text-violet-800',
  Entertainment: 'bg-purple-100 text-purple-800',
  Shopping: 'bg-amber-100 text-amber-800',
  Bills: 'bg-red-100 text-red-800',
  Other: 'bg-gray-100 text-gray-700',
}
