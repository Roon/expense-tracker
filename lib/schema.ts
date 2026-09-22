// lib/schema.ts
import { z } from 'zod'
import { CATEGORIES } from './types'

export const expenseSchema = z.object({
  date: z
    .string()
    .min(1, 'Date is required')
    .refine((v) => !isNaN(new Date(v).getTime()), 'Invalid date')
    .refine((v) => {
      const d = new Date(v)
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      return d <= today
    }, 'Date cannot be in the future'),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), 'Enter a valid amount (e.g. 12.50)')
    .refine((v) => parseFloat(v) > 0, 'Amount must be greater than 0'),
  category: z.enum(CATEGORIES as [Category, ...Category[]]),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(200, 'Description must be 200 characters or less'),
})

type Category = (typeof CATEGORIES)[number]
export type ExpenseFormValues = z.infer<typeof expenseSchema>
