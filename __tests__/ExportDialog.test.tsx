import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Expense } from '@/lib/types'
import { ExportButton } from '@/components/export/ExportButton'
import { exportExpenses } from '@/lib/export'

jest.mock('@/lib/export', () => {
  const actual = jest.requireActual('@/lib/export')
  return { ...actual, exportExpenses: jest.fn(actual.exportExpenses), downloadBlob: jest.fn() }
})
const { downloadBlob } = jest.requireMock('@/lib/export') as { downloadBlob: jest.Mock }
const mockedExport = exportExpenses as jest.MockedFunction<typeof exportExpenses>

const EXPENSES: Expense[] = [
  { id: '1', date: '2026-01-15', amount: 25.5, category: 'Food', description: 'Lunch' },
  { id: '2', date: '2026-02-10', amount: 80, category: 'Bills', description: 'Electric' },
  { id: '3', date: '2026-03-05', amount: 12, category: 'Entertainment', description: 'Movie' },
]

function setup() {
  const user = userEvent.setup()
  render(<ExportButton expenses={EXPENSES} />)
  return user
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /export/i }))
  return screen.getByRole('dialog', { name: /export expenses/i })
}

const previewRows = (dialog: HTMLElement) => within(dialog).getAllByRole('row').length - 1 // minus header

// jsdom's Blob has no .text(); FileReader is supported.
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

afterEach(() => {
  jest.useRealTimers()
})

it('opens a modal dialog with every record previewed', async () => {
  const user = setup()
  const dialog = await openDialog(user)
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(previewRows(dialog)).toBe(3)
  expect(within(dialog).getByRole('button', { name: 'Export 3 records' })).toBeEnabled()
  expect(within(dialog).getByText('$117.50', { selector: 'dd' })).toBeInTheDocument()
})

it('filters the preview by category and date range', async () => {
  const user = setup()
  const dialog = await openDialog(user)

  await user.click(within(dialog).getByRole('checkbox', { name: /Food/ }))
  expect(previewRows(dialog)).toBe(2)
  expect(within(dialog).queryByText('Lunch')).not.toBeInTheDocument()

  await user.type(within(dialog).getByLabelText('Start date'), '2026-03-01')
  expect(previewRows(dialog)).toBe(1)
  expect(within(dialog).getByRole('button', { name: 'Export 1 record' })).toBeEnabled()
})

it('blocks export with a message when no categories are selected', async () => {
  const user = setup()
  const dialog = await openDialog(user)
  await user.click(within(dialog).getByRole('button', { name: 'Clear' }))
  expect(within(dialog).getByText('Select at least one category.')).toBeInTheDocument()
  expect(within(dialog).getByText('No expenses match these filters')).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: /^Export 0 records/ })).toBeDisabled()
})

it('blocks export when the start date is after the end date', async () => {
  const user = setup()
  const dialog = await openDialog(user)
  await user.type(within(dialog).getByLabelText('End date'), '2026-01-01')
  await user.type(within(dialog).getByLabelText('Start date'), '2026-02-01')
  expect(within(dialog).getByText(/Start date must be on or before/)).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: /^Export \d+ record/ })).toBeDisabled()
})

it('updates the extension and resolved filename as format and name change', async () => {
  const user = setup()
  const dialog = await openDialog(user)
  const name = within(dialog).getByLabelText('File name')
  await user.clear(name)
  await user.type(name, 'Q1: report')
  await user.click(within(dialog).getByRole('radio', { name: /JSON/ }))
  expect(within(dialog).getByText('.json')).toBeInTheDocument()
  expect(within(dialog).getByText('Q1 report.json')).toBeInTheDocument()
})

it('shows a loading state, downloads, then closes itself', async () => {
  jest.useFakeTimers()
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
  render(<ExportButton expenses={EXPENSES} />)
  const dialog = await openDialog(user)

  let resolve!: () => void
  const gate = new Promise<void>((r) => (resolve = r))
  const actual = jest.requireActual('@/lib/export').exportExpenses
  mockedExport.mockImplementationOnce(async (...args) => {
    await gate
    return actual(...args)
  })

  await user.click(within(dialog).getByRole('radio', { name: /JSON/ }))
  await user.click(within(dialog).getByRole('button', { name: 'Export 3 records' }))
  expect(within(dialog).getByRole('button', { name: /Preparing JSON/ })).toBeDisabled()
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()

  await act(async () => resolve())
  expect(downloadBlob).toHaveBeenCalledTimes(1)
  const [blob, filename] = downloadBlob.mock.calls[0]
  expect(filename).toMatch(/^expenses-\d{4}-\d{2}-\d{2}\.json$/)
  expect(JSON.parse(await readBlob(blob as Blob)).expenses).toHaveLength(3)
  expect(within(dialog).getByText(/Exported 3 records to/)).toBeInTheDocument()

  act(() => jest.advanceTimersByTime(1500))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('reports failures and lets the user retry', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockedExport.mockRejectedValueOnce(new Error('boom'))
  const user = setup()
  const dialog = await openDialog(user)
  await user.click(within(dialog).getByRole('button', { name: 'Export 3 records' }))
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Export failed')
  expect(within(dialog).getByRole('button', { name: 'Export 3 records' })).toBeEnabled()
})

it('closes on Escape and restores focus to the trigger', async () => {
  const user = setup()
  await openDialog(user)
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /export/i })).toHaveFocus()
})

it('traps Tab focus inside the dialog', async () => {
  const user = setup()
  const dialog = await openDialog(user)
  for (let i = 0; i < 40; i++) {
    await user.tab()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
  }
})
