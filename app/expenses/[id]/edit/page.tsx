// app/expenses/[id]/edit/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useExpenses } from '@/hooks/useExpenses'
import { ExpenseForm } from '@/components/ExpenseForm'
import { EmptyState } from '@/components/EmptyState'
import type { ExpenseFormValues } from '@/lib/schema'
import type { Category } from '@/lib/types'

export default function EditExpensePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { expenses, updateExpense, isLoaded } = useExpenses()

  const expense = expenses.find((e) => e.id === params.id)

  if (!isLoaded) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!expense) {
    return (
      <EmptyState
        title="Expense not found"
        description="This expense may have been deleted."
        actionLabel="Back to Expenses"
        actionHref="/expenses"
      />
    )
  }

  function handleSubmit(data: ExpenseFormValues) {
    updateExpense(params.id, {
      date: data.date,
      amount: parseFloat(data.amount),
      category: data.category as Category,
      description: data.description,
    })
    router.push('/expenses')
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Expense</h1>
        <p className="text-sm text-gray-500 mt-1">Update the expense details</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <ExpenseForm
          defaultValues={{
            date: expense.date,
            amount: expense.amount.toString(),
            category: expense.category,
            description: expense.description,
          }}
          onSubmit={handleSubmit}
          onCancel={() => router.back()}
          submitLabel="Save Changes"
        />
      </div>
    </div>
  )
}
