// app/expenses/new/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useExpenses } from '@/hooks/useExpenses'
import { ExpenseForm } from '@/components/ExpenseForm'
import type { ExpenseFormValues } from '@/lib/schema'

export default function NewExpensePage() {
  const router = useRouter()
  const { addExpense } = useExpenses()

  function handleSubmit(data: ExpenseFormValues) {
    addExpense({
      date: data.date,
      amount: parseFloat(data.amount),
      category: data.category as import('@/lib/types').Category,
      description: data.description,
    })
    router.push('/expenses')
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Add Expense</h1>
        <p className="text-sm text-gray-500 mt-1">Record a new expense</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <ExpenseForm
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
          submitLabel="Add Expense"
        />
      </div>
    </div>
  )
}
