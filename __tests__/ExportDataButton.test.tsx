import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportDataButton } from '@/components/ExportDataButton'
import type { Exporter } from '@/lib/exporting'
import type { Expense } from '@/lib/types'

const EXPENSES: Expense[] = [{ id: '1', date: '2024-01-15', amount: 25.5, category: 'Food', description: 'Lunch' }]

it('hands the expenses to the injected exporter when clicked', async () => {
  const exporter: Exporter<Expense> = { export: jest.fn() }
  render(<ExportDataButton expenses={EXPENSES} exporter={exporter} />)
  await userEvent.click(screen.getByRole('button', { name: 'Export Data' }))
  expect(exporter.export).toHaveBeenCalledTimes(1)
  expect(exporter.export).toHaveBeenCalledWith(EXPENSES)
})
