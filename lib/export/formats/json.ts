// lib/export/formats/json.ts
import type { ExportPayload } from '../types'

export function toJSONDocument({ expenses, summary, filters, generatedAt }: ExportPayload) {
  return {
    exportedAt: generatedAt.toISOString(),
    filters: {
      startDate: filters.startDate || null,
      endDate: filters.endDate || null,
      categories: filters.categories,
    },
    summary,
    expenses: expenses.map(({ id, date, category, amount, description }) => ({
      id,
      date,
      category,
      amount,
      description,
    })),
  }
}

export async function serializeJSON(payload: ExportPayload): Promise<Blob> {
  const json = JSON.stringify(toJSONDocument(payload), null, 2)
  return new Blob([json], { type: 'application/json' })
}
